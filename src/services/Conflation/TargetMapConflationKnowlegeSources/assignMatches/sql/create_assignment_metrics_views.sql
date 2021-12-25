-- NOTE: Rounding should use same precision as in ../utils/loadChosenMatchDisputes.ts
--       Currently, precision is 4.

BEGIN;

CREATE VIEW assignment_metrics AS
  SELECT
      edge_id,

      target_map_id,

      target_map_edge_length,

      is_unidirectional,

      forward_matches_length_sum,

      backward_matches_length_sum,

      IIF(
        is_unidirectional,

        -- If UnidirectionalTargetMapEdge, only needs matches in a single direction.
        IFNULL(
          (
            ( forward_matches_length_sum > 0 )
            OR
            ( backward_matches_length_sum > 0 )
          ), 0
        ),

        -- If BidirectionalTargetMapEdge, only needs matches in both directions.
        IFNULL(
          (
            ( forward_matches_length_sum > 0 )
            AND
            ( backward_matches_length_sum > 0 )
          ), 0
        )
      ) AS is_matched

    FROM (
      SELECT
          edge_id,

          target_map_id, -- Included to assist developer. QA WebApp's ConflationAnalyisView uses TargetMapIds.

          ROUND(target_map_edge_length, 4) AS target_map_edge_length,

          is_unidirectional,

          ROUND(
            NULLIF(
              SUM( ( section_end - section_start ) * ( is_forward = 1 ) ),
              0
            ),
            4
          ) AS forward_matches_length_sum,

          ROUND(
            NULLIF(
              SUM( ( section_end - section_start ) * ( is_forward = 0 ) ),
              0
            ),
            4
          ) AS backward_matches_length_sum

        FROM target_map_edge_metadata AS a
          LEFT JOIN assigned_matches_view AS b
            USING (edge_id)

        GROUP BY edge_id
    )
  ;


CREATE VIEW assigned_matching_stats AS
  SELECT
      edge_id,

      target_map_id,

      target_map_edge_length,

      is_unidirectional,

      forward_matches_length_sum,
      backward_matches_length_sum,

      is_matched,

      forward_assignments_length_diff,
      backward_assignments_length_diff,

      max_assignments_length_diff,

      ( max_assignments_length_diff < 0.005 ) AS matched_diff_lt_5m,

      (
        ( max_assignments_length_diff >= 0.005 )
        AND
        ( max_assignments_length_diff < 0.010 )
      ) AS matched_diff_gte_5m_lt_10m,

      (
        ( max_assignments_length_diff >= 0.010 )
        AND
        ( max_assignments_length_diff < 0.100 )
      ) AS matched_diff_gte_10m_lt_100m,

      ( max_assignments_length_diff >= 0.100 ) AS matched_diff_gte_100m

    FROM (
      SELECT
          edge_id,

          target_map_id,

          target_map_edge_length,

          is_unidirectional,

          forward_matches_length_sum,
          backward_matches_length_sum,

          is_matched,

          forward_assignments_length_diff,
          backward_assignments_length_diff,

          MAX(
            ABS(IFNULL(forward_assignments_length_diff, 0)),
            ABS(IFNULL(backward_assignments_length_diff, 0))
          ) AS max_assignments_length_diff

        FROM (
          SELECT
              edge_id,

              target_map_id,

              target_map_edge_length,

              is_unidirectional,

              forward_matches_length_sum,
              backward_matches_length_sum,

              is_matched,

              IIF(
                ( ( NOT is_matched ) OR ( forward_matches_length_sum > 0 ) ),

                ROUND( forward_matches_length_sum - target_map_edge_length, 4 ),

                NULL
              ) AS forward_assignments_length_diff,

              IIF(
                ( ( NOT is_matched ) OR ( backward_matches_length_sum > 0 ) ),

                ROUND( backward_matches_length_sum - target_map_edge_length, 4 ),

                NULL
              ) AS backward_assignments_length_diff

            FROM assignment_metrics
        )
    )
  ;

CREATE VIEW assigned_matches_aggregate_stats AS
    SELECT
        COUNT(1) AS edges_ct,

        SUM(is_matched) AS is_matched_ct,

        ROUND(
          ( SUM(is_matched) * 1.0 ) / COUNT(1),
          5
        ) AS is_matched_ratio,

        ROUND(
          ( SUM( is_matched AND matched_diff_lt_5m ) / SUM(is_matched * 1.0) ),
          5
        ) AS matched_diff_lt_5m_ratio,

        ROUND(
          ( SUM( is_matched AND matched_diff_gte_5m_lt_10m ) / SUM(is_matched * 1.0) ),
          5
        ) AS matched_diff_gte_5m_lt_10m_ratio,

        ROUND(
          ( SUM( is_matched AND matched_diff_gte_10m_lt_100m ) / SUM(is_matched * 1.0) ),
          5
        ) AS matched_diff_gte_10m_lt_100m_ratio,

        ROUND(
          ( SUM( is_matched AND matched_diff_gte_100m ) / SUM(is_matched * 1.0) ),
          5
        ) AS matched_diff_gte_100m_ratio

      FROM assigned_matching_stats ;

COMMIT;
