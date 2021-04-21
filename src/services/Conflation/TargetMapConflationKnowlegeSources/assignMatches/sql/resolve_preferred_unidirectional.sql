DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE (edge_id, is_forward)
  IN (
    SELECT
        edge_id,
        (NOT forward_dir_is_preferred) AS is_forward
      FROM target_map_unidirectional_edge_preferred_direction
      WHERE (
        avg_total_deviance_diff_sufficient
        AND
        preferred_direction_total_distance_sufficient
      )
  )
;

-- TODO: Add to discovered_knaves the non-preferred for unidirectional edges where
--         deviance or poor length coverage exceed threshold
