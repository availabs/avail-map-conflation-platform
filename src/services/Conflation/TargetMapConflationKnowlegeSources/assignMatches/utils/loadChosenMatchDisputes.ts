/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database as SqliteDatabase } from 'better-sqlite3';

const createTablesSql = readFileSync(
  join(__dirname, '../sql/create_chosen_match_disputes_tables.sql'),
  { encoding: 'utf-8' },
);

export default function loadChosenMatchDisputes(db: SqliteDatabase) {
  db.exec('BEGIN;');

  db.exec(createTablesSql);

  const disputeInsertStmt = db.prepare(`
    INSERT INTO chosen_match_disputed_sections (
      dispute_id,
      shst_geometry_id,
      shst_reference_id,
      disputed_section_start,
      disputed_section_end
    ) VALUES (?, ?, ?, ?, ?) ;
  `);

  const claimantInsertStmt = db.prepare(`
    INSERT INTO chosen_match_dispute_claimants (
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
          json_extract(value, '$.path_id'),
          json_extract(value, '$.path_edge_idx'),
          json_extract(value, '$.edge_id'),
          json_extract(value, '$.is_forward'),
          json_extract(value, '$.edge_shst_match_idx'),
          json_extract(value, '$.section_start'),
          json_extract(value, '$.section_end')
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
            MIN(a.section_start, b.section_start) AS disputed_section_start,
            MAX(a.section_end, b.section_end) AS disputed_section_end,
            (
              '[' ||
                group_concat( DISTINCT
                  json_object(
                    'path_id',              a.path_id,
                    'path_edge_idx',        a.path_edge_idx,
                    'edge_id',              a.edge_id,
                    'is_forward',           a.is_forward,
                    'edge_shst_match_idx',  a.edge_shst_match_idx,
                    'section_start',        a.section_start,
                    'section_end',          a.section_end
                  )
                  || ',' ||
                  json_object(
                    'path_id',              b.path_id,
                    'path_edge_idx',        b.path_edge_idx,
                    'edge_id',              b.edge_id,
                    'is_forward',           b.is_forward,
                    'edge_shst_match_idx',  b.edge_shst_match_idx,
                    'section_start',        b.section_start,
                    'section_end',          b.section_end
                  )
                ) ||
              ']'
            ) AS shst_ref_seg_claimants
          FROM target_map_bb.target_map_edge_chosen_matches AS a
            INNER JOIN target_map_bb.target_map_edge_chosen_matches AS b
              USING (shst_reference)
            INNER JOIN source_map.shst_references AS c
              ON ( a.shst_reference = c.id )
          WHERE (
            -- Assumes no disputes within path
            ( a.path_id < b.path_id )
            AND
            (
              ( a.section_start < b.section_end )
              AND
              ( b.section_start < a.section_end )
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

  console.warn();
  console.warn(
    'FIXME: Why is "OR IGNORE" required in INSERT OR IGNORE INTO chosen_match_dispute_claimants_initial',
  );
  console.warn();

  db.exec(`
    INSERT OR IGNORE INTO chosen_match_dispute_claimants_initial (
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
        FROM chosen_match_dispute_claimants
    ;
  `);

  db.exec('COMMIT;');

  // @ts-ignore
  db.unsafeMode(false);
}
