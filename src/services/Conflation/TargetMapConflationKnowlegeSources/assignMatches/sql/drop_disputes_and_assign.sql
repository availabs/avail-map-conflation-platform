-- TODO, FIXME, NOTE: Need to provide in comments a clear explanation of this transaction's logic
--                      and a solid proof of its correctness.

BEGIN;

CREATE TEMPORARY TABLE tmp_disputes_with_single_path_claimants
  AS
    SELECT
        dispute_id,
        COUNT( DISTINCT
          -- Need to guarantee no intra-path disputes. Possible with opposite directions.
          -- FIXME: Make sure this is logically correct for forward/backward
          CAST(path_id AS TEXT)
          || '|'
          || CAST(is_forward AS TEXT)
        ) AS num_paths_with_claimants
      FROM chosen_match_unresolved_disputes_claimants
      GROUP BY dispute_id ;

INSERT OR IGNORE INTO awarded_matches
  SELECT DISTINCT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM chosen_match_unresolved_disputes_sections
      INNER JOIN (
        SELECT
            dispute_id,
            edge_id,
            is_forward,
            section_start,
            section_end
          FROM chosen_match_unresolved_disputes_claimants
            INNER JOIN tmp_disputes_with_single_path_claimants
              USING (dispute_id)
          WHERE ( num_paths_with_claimants = 1 )
      ) USING ( dispute_id )
;

-- These were just added to assigned.
DELETE FROM chosen_match_unresolved_disputes_sections
  WHERE dispute_id IN (
    SELECT
        dispute_id
      FROM tmp_disputes_with_single_path_claimants
      WHERE ( num_paths_with_claimants = 1 )
  );

DROP TABLE tmp_disputes_with_single_path_claimants;

CREATE TEMPORARY TABLE tmp_no_more_disputes
  AS
    SELECT
        a.*
      FROM chosen_match_unresolved_disputes_claimants as a
        LEFT OUTER JOIN chosen_match_unresolved_disputes_claimants as b
          ON (
            ( a.dispute_id = b.dispute_id )
            AND
            ( a.edge_id <> b.edge_id )
            AND
            ( a.section_start < b.section_end )
            AND
            ( b.section_start < a.section_end )
          )
      WHERE b.edge_id IS NULL ; -- No dispute claimants overlap this edge's claim.

INSERT OR IGNORE INTO awarded_matches
  SELECT DISTINCT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM chosen_match_unresolved_disputes_sections
      INNER JOIN (
        SELECT
            a.dispute_id,
            a.edge_id,
            a.is_forward,
            a.section_start,
            a.section_end
          FROM chosen_match_unresolved_disputes_claimants AS a
            INNER JOIN tmp_no_more_disputes AS b
              USING (
                dispute_id,
                path_id,
                path_edge_idx,
                is_forward
              )
      ) USING ( dispute_id ) ;

-- These were just added to assigned.
DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE ( dispute_id, path_id, path_edge_idx, is_forward ) IN (
    SELECT
        dispute_id,
        path_id,
        path_edge_idx,
        is_forward
      FROM tmp_no_more_disputes
  )
;

DELETE FROM chosen_match_unresolved_disputes_sections
  WHERE ( dispute_id ) IN (
    SELECT
        dispute_id
      FROM chosen_match_unresolved_disputes_sections AS a
        INNER JOIN chosen_match_unresolved_disputes_claimants AS b
          USING (dispute_id)
        WHERE ( b.path_id IS NULL ) -- No more dispute claimants
  ) ;

DROP TABLE tmp_no_more_disputes ;

-- Update the disputed section start/end.
UPDATE chosen_match_unresolved_disputes_sections AS a
  SET
      disputed_section_start = b.disputed_section_start,
      disputed_section_end = b.disputed_section_end
    FROM (
      SELECT
          dispute_id,
          MIN(section_start) AS disputed_section_start,
          MAX(section_end) AS disputed_section_end
        FROM chosen_match_unresolved_disputes_claimants
        GROUP BY dispute_id
    ) AS b
    WHERE ( a.dispute_id = b.dispute_id ) ;

COMMIT;


