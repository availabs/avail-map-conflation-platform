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
-- > \d discovered_knaves
-- +-----+-------------------+---------+---------+------------+----+
-- | cid | name              | type    | notnull | dflt_value | pk |
-- +-----+-------------------+---------+---------+------------+----+
-- | 0   | shst_reference_id | TEXT    | 1       | <null>     | 1  |
-- | 1   | edge_id           | INTEGER | 1       | <null>     | 2  |
-- | 2   | is_forward        | INTEGER | 1       | <null>     | 3  |
-- | 3   | section_start     | REAL    | 1       | <null>     | 4  |
-- | 4   | section_end       | REAL    | 1       | <null>     | 5  |
-- +-----+-------------------+---------+---------+------------+----+
--
-- > \d target_map_unidirectional_edge_preferred_direction
-- +-----+-----------------------------------------------+---------+---------+------------+----+
-- | cid | name                                          | type    | notnull | dflt_value | pk |
-- +-----+-----------------------------------------------+---------+---------+------------+----+
-- | 0   | path_id                                       | INTEGER | 1       | <null>     | 1  |
-- | 1   | edge_id                                       | INTEGER | 1       | <null>     | 2  |
-- | 2   | target_map_id                                 | TEXT    | 1       | <null>     | 0  |
-- | 3   | target_map_edge_length                        | REAL    | 1       | <null>     | 0  |
-- | 4   | forward_avg_total_deviance                    | REAL    | 1       | <null>     | 0  |
-- | 5   | backward_avg_total_deviance                   | REAL    | 1       | <null>     | 0  |
-- | 6   | forward_total_chosen_matches_len              | REAL    | 1       | <null>     | 0  |
-- | 7   | backward_total_chosen_matches_len             | REAL    | 1       | <null>     | 0  |
-- | 8   | xdir_avg_total_deviance_diff                  | REAL    | 1       | <null>     | 0  |
-- | 9   | xdir_avg_total_deviance_ratio                 | REAL    | 1       | <null>     | 0  |
-- | 10  | xdir_total_chosen_matches_len_diff            | REAL    | 1       | <null>     | 0  |
-- | 11  | xdir_total_chosen_matches_len_ratio           | REAL    | 1       | <null>     | 0  |
-- | 12  | forward_dir_is_preferred                      | INTEGER | 1       | <null>     | 0  |
-- | 13  | avg_total_deviance_diff_sufficient            | INTEGER | 1       | <null>     | 0  |
-- | 14  | preferred_direction_total_distance_sufficient | INTEGER | 1       | <null>     | 0  |
-- +-----+-----------------------------------------------+---------+---------+------------+----+
--
-- nys_ris_conflation_blackboard> \d target_map_edge_chosen_matches
-- +-----+---------------------+---------+---------+------------+----+
-- | cid | name                | type    | notnull | dflt_value | pk |
-- +-----+---------------------+---------+---------+------------+----+
-- | 0   | path_id             | INTEGER | 1       | <null>     | 1  |
-- | 1   | path_edge_idx       | INTEGER | 1       | <null>     | 2  |
-- | 2   | edge_id             | INTEGER | 1       | <null>     | 0  |
-- | 3   | is_forward          | INTEGER | 1       | <null>     | 3  |
-- | 4   | edge_shst_match_idx | INTEGER | 1       | <null>     | 0  |
-- | 5   | shst_reference      | TEXT    | 1       | <null>     | 4  |
-- | 6   | section_start       | REAL    | 1       | <null>     | 0  |
-- | 7   | section_end         | REAL    | 1       | <null>     | 0  |
-- | 8   | along_edge_start    | REAL    | 1       | <null>     | 0  |
-- | 9   | along_edge_end      | REAL    | 1       | <null>     | 0  |
-- | 10  | avg_deviance_km     | REAL    | 0       | <null>     | 0  |
-- +-----+---------------------+---------+---------+------------+----+

INSERT OR IGNORE INTO discovered_knaves (
  shst_reference_id,
  edge_id,
  is_forward,
  section_start,
  section_end
)
  SELECT DISTINCT
      a.shst_reference,
      a.edge_id,
      a.is_forward,
      a.section_start,
      a.section_end
    FROM target_map_bb.target_map_edge_chosen_matches AS a
      INNER JOIN target_map_unidirectional_edge_preferred_direction AS b
        ON (
          ( a.edge_id = b.edge_id )
          AND
          ( a.is_forward <> b.forward_dir_is_preferred )
        )
    WHERE (
      avg_total_deviance_diff_sufficient
      AND
      preferred_direction_total_distance_sufficient
    )
;
