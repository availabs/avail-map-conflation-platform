BEGIN;

WITH cte_disputes_with_single_path_claimants AS (
  SELECT
      dispute_id,
      COUNT( DISTINCT
        -- Need to guarantee no intra-path disputes. Possible with opposite directions.
        CAST(path_id AS TEXT)
        || '|'
        || CAST(is_forward AS TEXT)
      ) AS num_paths_with_claimants
    FROM chosen_match_dispute_claimants
    GROUP BY dispute_id
)
INSERT OR IGNORE INTO assigned_matches
  SELECT DISTINCT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM chosen_match_disputed_sections
      INNER JOIN (
        SELECT
            dispute_id,
            edge_id,
            is_forward,
            section_start,
            section_end
          FROM chosen_match_dispute_claimants
            INNER JOIN (cte_disputes_with_single_path_claimants)
              USING (dispute_id)
          WHERE ( num_paths_with_claimants = 1 )
      ) USING ( dispute_id )
;

DELETE FROM chosen_match_disputed_sections
  WHERE dispute_id IN (
    SELECT
        dispute_id
      FROM chosen_match_dispute_claimants
      GROUP BY dispute_id
      HAVING COUNT(1) = 1
  );

COMMIT;
