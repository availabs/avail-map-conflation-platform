BEGIN;

DROP TABLE IF EXISTS target_map_unidirectional_edge_preferred_direction ;

CREATE TABLE target_map_unidirectional_edge_preferred_direction (
  path_id                                         INTEGER NOT NULL,
  --  path_edge_idx                                   INTEGER NOT NULL,

  edge_id                                         INTEGER NOT NULL,

  target_map_id                                   TEXT NOT NULL,
  target_map_edge_length                          REAL NOT NULL,

  forward_avg_total_deviance                      REAL NOT NULL,
  backward_avg_total_deviance                     REAL NOT NULL,

  forward_total_chosen_matches_len                REAL NOT NULL,
  backward_total_chosen_matches_len               REAL NOT NULL,

  xdir_avg_total_deviance_diff                    REAL NOT NULL,

  xdir_avg_total_deviance_ratio                   REAL NOT NULL,

  xdir_total_chosen_matches_len_diff              REAL NOT NULL,

  xdir_total_chosen_matches_len_ratio             REAL NOT NULL,

  forward_dir_is_preferred                        INTEGER NOT NULL,

  avg_total_deviance_diff_sufficient              INTEGER NOT NULL,

  preferred_direction_total_distance_sufficient   INTEGER NOT NULL,

  PRIMARY KEY(
    path_id,
    edge_id
  )
) WITHOUT ROWID;

CREATE INDEX target_map_unidirectional_edge_preferred_direction_edge_id_idx
  ON target_map_unidirectional_edge_preferred_direction(edge_id) ;

INSERT INTO target_map_unidirectional_edge_preferred_direction (
  path_id,
  --  path_edge_idx,

  edge_id,

  target_map_id,
  target_map_edge_length,

  forward_avg_total_deviance,
  backward_avg_total_deviance,

  forward_total_chosen_matches_len,
  backward_total_chosen_matches_len,

  xdir_avg_total_deviance_diff,

  xdir_avg_total_deviance_ratio,

  xdir_total_chosen_matches_len_diff,

  xdir_total_chosen_matches_len_ratio,

  forward_dir_is_preferred,

  avg_total_deviance_diff_sufficient,

  preferred_direction_total_distance_sufficient
)
  SELECT
      path_id,
      --  path_edge_idx,

      edge_id,

      a.target_map_id,
      a.target_map_edge_length,

      a.avg_total_deviance AS forward_avg_total_deviance,
      b.avg_total_deviance AS backward_avg_total_deviance,

      a.total_chosen_matches_len AS forward_total_chosen_matches_len,
      b.total_chosen_matches_len AS backward_total_chosen_matches_len,

      ABS( a.avg_total_deviance - b.avg_total_deviance ) AS xdir_avg_total_deviance_diff,

      (
        MAX( a.avg_total_deviance, b.avg_total_deviance )
          / MIN( a.avg_total_deviance, b.avg_total_deviance )
      ) AS xdir_avg_total_deviance_ratio,

      ABS( a.total_chosen_matches_len - b.total_chosen_matches_len ) AS xdir_total_chosen_matches_len_diff,

      (
        MAX( a.total_chosen_matches_len, b.total_chosen_matches_len )
          / MIN( a.total_chosen_matches_len, b.total_chosen_matches_len )
      ) AS xdir_total_chosen_matches_len_ratio,

      ( a.avg_total_deviance < b.avg_total_deviance ) AS forward_dir_is_preferred,

      -- AvgTotalDevianceRatio at least 10%
      (
        (
          MAX( a.avg_total_deviance, b.avg_total_deviance )
            / MIN( a.avg_total_deviance, b.avg_total_deviance )
        ) > 1.10
      ) AS avg_total_deviance_diff_sufficient,

      -- To make sure we are not selecting a direction because low coverage yielded low avg_total_deviance
      (
        -- ChosenMatches must cover at least 90% of edge length without exceeding 115%.
        (
          (
            IIF(
              ( a.avg_total_deviance < b.avg_total_deviance ), -- Preferred direction criteria
              a.total_chosen_matches_len,
              b.total_chosen_matches_len
            )
            / a.target_map_edge_length
          ) BETWEEN 0.9 AND 1.15
        )
        OR
        -- preferred direction ChosenMatches total length just as good as other direction.
        --   Difference between the ChosenMatches lengths less than 10% of the TMPathEdge length
        (
          (
            ABS( a.total_chosen_matches_len - b.total_chosen_matches_len )
              / a.target_map_edge_length
          ) < 0.1

          -- (
          --   (
          --     ABS( a.total_chosen_matches_len - b.total_chosen_matches_len )
          --       / MAX(a.total_chosen_matches_len - b.total_chosen_matches_len )
          --   ) < 0.1
          -- )
        )
      ) AS preferred_direction_total_distance_sufficient

    FROM target_map_path_edge_chosen_matches_aggregate_stats_view AS a
      INNER JOIN target_map_path_edge_chosen_matches_aggregate_stats_view AS b
        USING ( path_id, edge_id )
      INNER JOIN target_map_path_last_edge_idx AS c
        USING ( path_id )

    WHERE (
      ( a.is_unidirectional )
      AND
      ( a.is_forward AND ( NOT b.is_forward ) )
    )
;

COMMIT;
