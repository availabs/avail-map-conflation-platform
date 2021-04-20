/*
    Cases where the overlap between disputes is less than or equal to a threshold epsilon.

    How to store so that assignments/compromises currently blocked by an eventually dropped claim
      can eventually make their way through?

    Is it safe to mutate the segment_start and segment_ends of chosen_match_dispute_claimants?
      Would prefer not to, but how else to do it?

    NOTE: We don't want to give a pass to Knaves. Some disputes are red flags.
*/

CREATE TABLE epsilon_overlap_resolutions AS
WITH cte_epsilon_overlaps AS (
  SELECT
      dispute_id,

      a.path_id         AS path_id_a,
      a.path_edge_idx   AS path_edge_idx_a,
      a.is_forward      AS is_forward_a,

      b.path_id         AS path_id_b,
      b.path_edge_idx   AS path_edge_idx_b,
      b.is_forward      AS is_forward_b,

      a.section_start   AS section_start_a,
      ( ( a.section_end + b.section_start ) / 2 ) AS section_end_a,

      ( ( a.section_end + b.section_start ) / 2 ) AS section_start_b,
      b.section_end AS section_end_b

    FROM chosen_match_dispute_claimants AS a
      INNER JOIN chosen_match_dispute_claimants AS b
        USING ( dispute_id )
    WHERE (
      ( a.section_start < b.section_start )
      AND
      ( a.section_end < b.section_end )
      AND
      ( ( a.section_end - b.section_start ) BETWEEN 0 AND 0.005 )
    )
), cte_epsilon_overlaps_resolutions AS (
  SELECT
      dispute_id,
      path_id,
      path_edge_idx,
      is_forward,
      MAX(section_start) AS section_start,
      MIN(section_end) AS section_end
    FROM (
      SELECT
          dispute_id,
          path_id_a         AS path_id,
          path_edge_idx_a   AS path_edge_idx,
          is_forward_a      AS is_forward,
          section_start_a   AS section_start,
          section_end_a     AS section_end
        FROM cte_epsilon_overlaps
      UNION ALL
      SELECT
          dispute_id,
          path_id_b         AS path_id,
          path_edge_idx_b   AS path_edge_idx,
          is_forward_b      AS is_forward,
          section_start_b   AS section_start,
          section_end_b     AS section_end
        FROM cte_epsilon_overlaps
  )
  GROUP BY
    dispute_id,
    path_id,
    path_edge_idx,
    is_forward
)
SELECT
    dispute_id,
    path_id,
    path_edge_idx,
    is_forward,
    edge_shst_match_idx,
    a.section_start,
    a.section_end
  FROM cte_epsilon_overlaps_resolutions AS a
    INNER JOIN chosen_match_dispute_claimants AS b
      USING (
        dispute_id,
        path_id,
        path_edge_idx,
        is_forward
      )
;
