BEGIN;

DROP TABLE IF EXISTS shst_matches;

-- TODO: Make this a Temporary View
CREATE TABLE shst_matches (
  shst_reference_id   INTEGER NOT NULL,

  edge_id             INTEGER NOT NULL,

  section_start       REAL,
  section_end         REAL,

  PRIMARY KEY (
    shst_reference_id,
    edge_id
  ),

  -- NULL section_start and section_end means resolution dropped the ChosenMatch.
  CHECK(
    (
      ( section_start IS NOT NULL )
      AND
      ( section_end IS NOT NULL )
      AND
      ( section_start < section_end )
    )
    OR
    (
      ( section_start IS NULL )
      AND
      ( section_end IS NULL )
    )
  )
) WITHOUT ROWID;

INSERT OR IGNORE INTO shst_matches (
  shst_reference_id,
  edge_id,
  section_start,
  section_end
)
  SELECT
      shst_reference AS shst_reference_id,

      edge_id,

      MIN(section_start) AS section_start,

      MIN(section_end) AS section_end

    FROM target_map_bb.target_map_edges_shst_matches

    GROUP BY
      shst_reference,
      edge_id
  ;

CREATE INDEX shst_matches_edge_id_idx
  ON shst_matches (edge_id) ;

CREATE INDEX shst_matches_sections_idx
  ON shst_matches (shst_reference_id, section_start, section_end ) ;

-- FIXME: Real slow. 200sec for Albany County.
--        NOTE: Works well when edge_id in WHERE condition
--              Potentially alright as long as we only query for
--                * edges where needed(such as UnmatchedTMEdges)
--                * ShstReferences not in assigned or chosen (Cul-de-Sacs)
CREATE VIEW nonconflicting_shst_matches
 AS
   SELECT
       a.shst_reference_id,
       a.edge_id,
       a.section_start,
       a.section_end

     FROM shst_matches AS a
       LEFT OUTER JOIN chosen_match_initial_undisputed_claims AS b
        ON (
           ( a.shst_reference_id = b.shst_reference_id )
           AND
           (
             ( a.section_start < b.section_end )
             AND
             ( b.section_start < a.section_end )
           )
         )

       LEFT OUTER JOIN awarded_matches AS c
         ON (
           ( a.shst_reference_id = c.shst_reference_id )
           AND
           (
             ( a.section_start < c.section_end )
             AND
             ( c.section_start < a.section_end )
           )
         )

       LEFT OUTER JOIN chosen_match_unresolved_disputes_sections AS d
         ON (
           ( a.shst_reference_id = d.shst_reference_id )
           AND
           (
             ( a.section_start < d.disputed_section_end )
             AND
             ( d.disputed_section_start < a.section_end )
           )
         )

       LEFT OUTER JOIN discovered_knaves AS e
         ON (
           ( a.shst_reference_id = e.shst_reference_id )
           AND
           ( a.edge_id = e.edge_id )
         )

   WHERE (
     (
      ( (b.shst_reference_id, b.edge_id) IN (
          SELECT
              shst_reference_id,
              edge_id
            FROM discovered_knaves
        )
      )
      OR
      ( b.shst_reference_id IS NULL )
     )
     AND
     ( c.shst_reference_id IS NULL )
     AND
     ( d.shst_reference_id IS NULL )
     AND
     ( e.shst_reference_id IS NULL )
   ) ;


CREATE VIEW viable_backfill_shst_matches
  AS
    SELECT
        a.*
      FROM (
        SELECT
            *
          FROM nonconflicting_shst_matches
          WHERE (
            edge_id NOT IN (
              SELECT
                  edge_id
                FROM chosen_match_initial_undisputed_claims

              UNION ALL

              SELECT
                  edge_id
                FROM chosen_match_initial_disputes_claimants
            )
          )
      ) AS a LEFT OUTER JOIN (
        SELECT
            *
          FROM nonconflicting_shst_matches
          WHERE (
            edge_id NOT IN (
              SELECT
                  edge_id
                FROM chosen_match_initial_undisputed_claims

              UNION ALL

              SELECT
                  edge_id
                FROM chosen_match_initial_disputes_claimants
            )
          )
      ) AS b ON (
        ( a.shst_reference_id = b.shst_reference_id )
        AND
        ( a.edge_id <> b.edge_id )
        AND
        (
          ( a.section_start < b.section_end ) 
          AND
          ( b.section_start < a.section_end )
        )
      )
    WHERE (
      ( b.shst_reference_id IS NULL )
      AND
      ( ( a.section_end - a.section_start ) > 0.003 )
    )
  ;

COMMIT;
