-- 1. Find unidirectional TargetMapEdges with bidirectional ChosenMatches
-- 2. Identify which direction is closer.
-- 3. Look in chosen_match_dispute_claimants for opportunity to
--    drop the unwanted ChosenMatch direction. (Other edge wants the ShstReference).

-- Edges in disputes where edge would be happy to get rid of the ChosenMatch.

-- TODO: Persist cte_unidir_preferred_chosen_match_dir
--         Distinguish two levels of "ChosenMatchPreference":
--           1. sufficient for disputed (lower deviation threshold) Win-win.
--           2. sufficient for undisputed (higher deviation threshold; not yet implemented)
--                Here we are making a decision not to trust the TargetMap metadata that tells
--                us when an edge should be unidirectional. Need good grounds for this decision.
--                Embeddedness and RoadClass difference might be just grounds.

WITH cte_unidir_chosen_match_dir_stats AS (
  SELECT
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,

      target_map_id,
      edge_len,

      total_deviance,
      total_chosen_matches_len,

      (total_deviance / total_chosen_matches_len) AS avg_total_deviance

    FROM (
      SELECT
          b.path_id,
          b.path_edge_idx,
          b.edge_id,
          b.is_forward,

          json_extract(a.properties, '$.targetMapId') AS target_map_id,
          json_extract(a.properties, '$.targetMapEdgeLength') AS edge_len,

          SUM( b.avg_deviance_km * (b.section_end - b.section_start) ) AS total_deviance,

          SUM(b.section_end - b.section_start) AS total_chosen_matches_len

        FROM target_map.target_map_ppg_edges AS a
          INNER JOIN target_map_bb.target_map_edge_chosen_matches AS b
            USING ( edge_id )
          INNER JOIN (
            SELECT DISTINCT
                edge_id
              FROM chosen_match_dispute_claimants AS x
          ) AS c USING (edge_id)

        WHERE ( json_extract(a.properties, '$.isUnidirectional') = 1 )

        GROUP BY
          b.path_id,
          b.path_edge_idx,
          b.edge_id,
          b.is_forward
    )
  ), cte_unidir_preferred_chosen_match_dir AS (
    SELECT
        a.path_id,
        a.path_edge_idx,
        a.edge_id,
        a.target_map_id,
        a.edge_len,

        a.avg_total_deviance AS forward_avg_total_deviance,
        b.avg_total_deviance AS backward_avg_total_deviance,

        a.total_chosen_matches_len AS forward_total_chosen_matches_len,
        b.total_chosen_matches_len AS backward_total_chosen_matches_len,

        ABS( a.avg_total_deviance - b.avg_total_deviance ) AS avg_total_deviance_diff,

        (
          MAX( a.avg_total_deviance, b.avg_total_deviance )
            / MIN( a.avg_total_deviance, b.avg_total_deviance )
        ) AS avg_total_deviance_ratio,

        ABS( a.total_chosen_matches_len - b.total_chosen_matches_len ) AS total_chosen_matches_len_diff,

        (
          MAX( a.total_chosen_matches_len, b.total_chosen_matches_len )
            / MIN( a.total_chosen_matches_len, b.total_chosen_matches_len )
        ) AS total_chosen_matches_len_ratio,

        ( a.avg_total_deviance < b.avg_total_deviance ) AS forward_dir_is_preferred,

        -- AvgTotalDevianceRatio at least 10%
        (
          (
            MAX( a.avg_total_deviance, b.avg_total_deviance )
              / MIN( a.avg_total_deviance, b.avg_total_deviance )
          ) > 1.10
        ) AS avg_total_deviance_diff_sufficient,

        CASE
          WHEN ( a.avg_total_deviance < b.avg_total_deviance )
            THEN (
              (
                -- ChosenMatches must cover at least 90% of edge length without exceeding 115%.
                (
                  ( a.total_chosen_matches_len - a.edge_len )
                    / a.edge_len
                ) BETWEEN 0.9 AND 1.15
              )
              OR
                -- preferred direction ChosenMatches total length just as good as other direction.
              (
                ABS( a.total_chosen_matches_len - a.edge_len )
                  <= ABS( b.total_chosen_matches_len - a.edge_len )
              )
            )
          ELSE (
              (
                -- ChosenMatches must cover at least 90% of edge length without exceeding 115%.
                (
                  ( b.total_chosen_matches_len - b.edge_len )
                    / b.edge_len
                ) BETWEEN 0.9 AND 1.15
              )
              OR
                -- preferred direction ChosenMatches total length just as good as other direction.
              (
                ABS( b.total_chosen_matches_len - b.edge_len )
                  <= ABS( a.total_chosen_matches_len - b.edge_len )
              )
            )
        END AS preferred_direction_total_distance_sufficient

      FROM cte_unidir_chosen_match_dir_stats AS a
        INNER JOIN cte_unidir_chosen_match_dir_stats AS b
          USING ( edge_id )

      WHERE ( a.is_forward AND NOT b.is_forward )
  )
  DELETE FROM chosen_match_dispute_claimants
    WHERE (edge_id, is_forward)
    IN (
      SELECT
          edge_id,
          forward_dir_is_preferred AS is_forward
        FROM cte_unidir_preferred_chosen_match_dir
        WHERE ( avg_total_deviance_diff_sufficient AND preferred_direction_total_distance_sufficient )
    )
;
