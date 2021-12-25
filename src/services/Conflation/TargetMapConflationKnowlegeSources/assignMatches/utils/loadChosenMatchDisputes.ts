/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database as SqliteDatabase } from 'better-sqlite3';

const createTablesSql = readFileSync(
  join(__dirname, '../sql/create_chosen_match_disputes_tables.sql'),
  { encoding: 'utf-8' },
);

const PRECISION = 4;

export default function loadChosenMatchDisputes(db: SqliteDatabase) {
  db.exec('BEGIN;');

  db.exec(createTablesSql);

  const disputeInsertStmt = db.prepare(`
    INSERT INTO chosen_match_initial_disputes_sections (
      dispute_id,
      shst_geometry_id,
      shst_reference_id,
      disputed_section_start,
      disputed_section_end
    ) VALUES (?, ?, ?, ?, ?) ;
  `);

  const claimantInsertStmt = db.prepare(`
    INSERT INTO chosen_match_initial_disputes_claimants (
      dispute_id,
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,
      edge_shst_match_idx,
      section_start,
      section_end
    )
      SELECT
          ? AS dispute_id,
          json_extract(value, '$.path_id')              AS path_id,
          json_extract(value, '$.path_edge_idx')        AS path_edge_idx,
          json_extract(value, '$.edge_id')              AS edge_id,
          json_extract(value, '$.is_forward')           AS is_forward,
          json_extract(value, '$.edge_shst_match_idx')  AS edge_shst_match_idx,
          json_extract(value, '$.section_start')        AS section_start,
          json_extract(value, '$.section_end')          AS section_end
        FROM (
            SELECT json(?) AS claimants
          ) AS t, json_each(t.claimants)
  `);

  // TODO: Assert that there are no disputes within a TargetMapPath

  const disputeIterator = db
    .prepare(
      `
        SELECT
            c.geometry_id AS shst_geometry_id,
            a.shst_reference AS shst_reference_id,
            ROUND(
              MIN(a.section_start, b.section_start),
              ${PRECISION}
            ) AS disputed_section_start,
            ROUND(
              MAX(a.section_end, b.section_end),
              ${PRECISION}
            ) AS disputed_section_end,
            (
              '[' ||
                group_concat( DISTINCT
                  json_object(
                    'path_id',              a.path_id,
                    'path_edge_idx',        a.path_edge_idx,
                    'edge_id',              a.edge_id,
                    'is_forward',           a.is_forward,
                    'edge_shst_match_idx',  a.edge_shst_match_idx,
                    'section_start',        ROUND(a.section_start, ${PRECISION}),
                    'section_end',          ROUND(a.section_end, ${PRECISION})
                  )
                  || ',' ||
                  json_object(
                    'path_id',              b.path_id,
                    'path_edge_idx',        b.path_edge_idx,
                    'edge_id',              b.edge_id,
                    'is_forward',           b.is_forward,
                    'edge_shst_match_idx',  b.edge_shst_match_idx,
                    'section_start',        ROUND(b.section_start, ${PRECISION}),
                    'section_end',          ROUND(b.section_end, ${PRECISION})
                  )
                ) ||
              ']'
            ) AS shst_ref_seg_claimants
          FROM target_map_bb.target_map_edge_chosen_matches AS a
            INNER JOIN target_map_bb.target_map_edge_chosen_matches AS b
              USING (shst_reference)
            INNER JOIN source_map.shst_references AS c
              ON ( a.shst_reference = c.id )
            LEFT OUTER JOIN discovered_knaves AS x
              ON (
                a.shst_reference = x.shst_reference_id
                AND
                a.edge_id = x.edge_id
                AND
                a.is_forward = x.is_forward
                AND
                a.section_start = x.section_start
                AND
                a.section_end = x.section_end
              )
            LEFT OUTER JOIN discovered_knaves AS y
              ON (
                b.shst_reference = y.shst_reference_id
                AND
                b.edge_id = y.edge_id
                AND
                b.is_forward = y.is_forward
                AND
                b.section_start = y.section_start
                AND
                b.section_end = y.section_end
              )
          WHERE (
            ( x.shst_reference_id IS NULL )
            AND
            ( y.shst_reference_id IS NULL )
            AND
            -- Assumes no disputes within path
            ( a.path_id < b.path_id )
            AND
            (
              ( ROUND(a.section_start, ${PRECISION}) < ROUND(b.section_end, ${PRECISION}) )
              AND
              ( ROUND(b.section_start, ${PRECISION}) < ROUND(a.section_end, ${PRECISION}) )
            )
          )
          GROUP BY 1, 2
        ;
      `,
    )
    .raw()
    .iterate();

  let disputeId = 0;

  for (const [
    shstGeometryId,
    shstReferenceId,
    disputedSectionStart,
    disputedSectionEnd,
    claimantsArrStr,
  ] of disputeIterator) {
    ++disputeId;

    disputeInsertStmt.run([
      disputeId,
      shstGeometryId,
      shstReferenceId,
      disputedSectionStart,
      disputedSectionEnd,
    ]);

    const claimants = _.uniqWith(JSON.parse(claimantsArrStr), _.isEqual);

    try {
      claimantInsertStmt.run([disputeId, JSON.stringify(claimants)]);
    } catch (err) {
      console.error(err);
      console.log(JSON.stringify(claimants, null, 4));
      process.exit(1);
    }
  }

  db.exec(`
    INSERT OR IGNORE INTO chosen_match_unresolved_disputes_sections (
      dispute_id,

      shst_geometry_id,
      shst_reference_id,

      disputed_section_start,
      disputed_section_end
    )
      SELECT
          dispute_id,

          shst_geometry_id,
          shst_reference_id,

          disputed_section_start,
          disputed_section_end
        FROM chosen_match_initial_disputes_sections
    ;

    INSERT OR IGNORE INTO chosen_match_unresolved_disputes_claimants (
      dispute_id,
      path_id,
      path_edge_idx,

      edge_id,

      is_forward,
      edge_shst_match_idx,

      section_start,
      section_end
    )
      SELECT
          dispute_id,
          path_id,
          path_edge_idx,

          edge_id,

          is_forward,
          edge_shst_match_idx,

          section_start,
          section_end
        FROM chosen_match_initial_disputes_claimants
    ;
  `);

  /*
      tmp-20494-uv5wiN6zia8h> \d chosen_match_initial_disputes_sections
      +-----+------------------------+---------+---------+------------+----+
      | cid | name                   | type    | notnull | dflt_value | pk |
      +-----+------------------------+---------+---------+------------+----+
      | 0   | dispute_id             | INTEGER | 1       | <null>     | 1  |
      | 1   | shst_geometry_id       | TEXT    | 1       | <null>     | 0  |
      | 2   | shst_reference_id      | TEXT    | 1       | <null>     | 0  |
      | 3   | disputed_section_start | REAL    | 1       | <null>     | 0  |
      | 4   | disputed_section_end   | REAL    | 1       | <null>     | 0  |
      +-----+------------------------+---------+---------+------------+----+

      tmp-20494-uv5wiN6zia8h> \d chosen_match_initial_disputes_claimants
      +-----+---------------------+---------+---------+------------+----+
      | cid | name                | type    | notnull | dflt_value | pk |
      +-----+---------------------+---------+---------+------------+----+
      | 0   | dispute_id          | INTEGER | 1       | <null>     | 0  |
      | 1   | path_id             | INTEGER | 1       | <null>     | 1  |
      | 2   | path_edge_idx       | INTEGER | 1       | <null>     | 2  |
      | 3   | edge_id             | INTEGER | 1       | <null>     | 0  |
      | 4   | is_forward          | INTEGER | 1       | <null>     | 3  |
      | ${PRECISION}   | edge_shst_match_idx | INTEGER | 1       | <null>     | 4  |
      | 6   | section_start       | REAL    | 1       | <null>     | 0  |
      | 7   | section_end         | REAL    | 1       | <null>     | 0  |
      +-----+---------------------+---------+---------+------------+----+
*/

  db.exec(`
    INSERT INTO chosen_match_initial_undisputed_claims (
      path_id,
      path_edge_idx,

      edge_id,
      is_forward,

      edge_shst_match_idx,

      shst_reference_id,

      section_start,
      section_end
    )
      SELECT
          a.path_id,
          a.path_edge_idx,

          a.edge_id,
          a.is_forward,

          a.edge_shst_match_idx,

          a.shst_reference AS shst_reference_id,

          ROUND(a.section_start, ${PRECISION}) AS section_start,
          ROUND(a.section_end, ${PRECISION}) AS section_end
        FROM target_map_bb.target_map_edge_chosen_matches AS a
          LEFT OUTER JOIN discovered_knaves AS x
            ON (
              ( a.shst_reference = x.shst_reference_id )
              AND
              ( a.edge_id = x.edge_id )
              AND
              ( a.is_forward = x.is_forward )
              AND (
                ( a.section_start < x.section_end )
                AND
                ( x.section_start < a.section_end )
              )
            )
        WHERE (
          ( ROUND(a.section_end, ${PRECISION}) > ROUND(a.section_start, ${PRECISION}) )
          AND
          ( x.shst_reference_id IS NULL )
        )

      EXCEPT

      SELECT
          path_id,
          path_edge_idx,

          edge_id,
          is_forward,

          edge_shst_match_idx,

          shst_reference_id,

          section_start,
          section_end

          FROM chosen_match_initial_disputes
      ;
  `);

  db.exec('COMMIT;');

  // @ts-ignore
  db.unsafeMode(false);
}
