-- TODO: Must make sure for noneulerian paths to choose an untrimmable instance of an edge
--         if the same edge is both trimmable and untrimmable for the path's ChosenMatches.

BEGIN;

-- Remove from chosen_match_unresolved_disputes_claimants edge self-disputes.
DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE (
    ( dispute_id, path_id, path_edge_idx, edge_id, is_forward )
    IN (
      SELECT
          dispute_id,
          path_id,
          path_edge_idx,
          edge_id,
          is_forward
        FROM (
          SELECT
              dispute_id,
              path_id,
              path_edge_idx,
              edge_id,
              is_forward,
              row_number() OVER(
                PARTITION BY
                  dispute_id,
                  edge_id
                ORDER BY
                  path_edge_idx,
                  path_id
              ) AS row_num
            FROM chosen_match_unresolved_disputes_claimants
        )
        WHERE ( row_num > 1 )
    )
  ) ;

COMMIT;
