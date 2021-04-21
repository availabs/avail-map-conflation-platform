-- If there is a single untrimmable in a dispute, it wins.
--   Single path may have multiple untrimmable sections in a dispute.
--     If there is a single path with untrimmables in the dispute,
--       then all untrimmables for that path win their section.

-- TODO: Delete from trimmable boundaries inward to preserve contiguousness

-- FIXME: NEED TO STUDY CLOSELY. HAVE NOT YET CRITIQUED.

BEGIN;

/*
  \d chosen_match_unresolved_disputes_claimants
  +-----+---------------------+---------+---------+------------+----+
  | cid | name                | type    | notnull | dflt_value | pk |
  +-----+---------------------+---------+---------+------------+----+
  | 0   | dispute_id          | INTEGER | 1       | <null>     | 1  |
  | 1   | path_id             | INTEGER | 1       | <null>     | 2  |
  | 2   | path_edge_idx       | INTEGER | 1       | <null>     | 3  |
  | 3   | edge_id             | INTEGER | 1       | <null>     | 0  |
  | 4   | is_forward          | INTEGER | 1       | <null>     | 4  |
  | 5   | edge_shst_match_idx | INTEGER | 1       | <null>     | 0  |
  | 6   | section_start       | REAL    | 1       | <null>     | 0  |
  | 7   | section_end         | REAL    | 1       | <null>     | 0  |
  +-----+---------------------+---------+---------+------------+----+

  > \d disputed_chosen_match_trimmability
  +-----+---------------------+---------+---------+------------+----+
  | cid | name                | type    | notnull | dflt_value | pk |
  +-----+---------------------+---------+---------+------------+----+
  | 0   | path_id             | INTEGER | 1       | <null>     | 1  |
  | 1   | path_edge_idx       | INTEGER | 1       | <null>     | 2  |
  | 2   | is_forward          | INTEGER | 1       | <null>     | 3  |
  | 3   | edge_shst_match_idx | INTEGER | 1       | <null>     | 4  |
  | 4   | start_trimmable     | INTEGER | 0       | <null>     | 0  |
  | 5   | end_trimmable       | INTEGER | 0       | <null>     | 0  |
  +-----+---------------------+---------+---------+------------+----+
*/

WITH cte_disputes_with_untrimmable_edges AS (
  SELECT
      dispute_id,
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM chosen_match_unresolved_disputes_claimants AS a
      INNER JOIN disputed_chosen_match_trimmability AS b
        USING (
          path_id,
          path_edge_idx,
          is_forward,
          edge_shst_match_idx
        )
    WHERE (
      ( NOT b.start_trimmable )
      AND
      ( NOT b.end_trimmable )
    )
), cte_disputes_with_single_path_dir_untrimmable_claimants AS (
  SELECT DISTINCT
      dispute_id,
      path_id
    FROM cte_disputes_with_untrimmable_edges AS a
      INNER JOIN cte_disputes_with_untrimmable_edges AS b
        USING (dispute_id, path_id)
      WHERE (
        NOT (
          ( a.path_edge_idx <> b.path_edge_idx )
          AND
          ( a.is_forward <> b.is_forward )
        )
        AND
        (
          ( a.section_start < b.section_end )
          AND
          ( b.section_start < a.section_end )
        )
      )
    GROUP BY dispute_id, path_id
    HAVING (
      COUNT( DISTINCT
        CAST(path_id AS TEXT)
        || '|'
        || CAST(a.is_forward AS TEXT) -- FIXME: What about b.is_forward ???
      ) = 1
    )
)
  DELETE FROM chosen_match_unresolved_disputes_claimants
    WHERE (dispute_id, path_id) IN (
      SELECT
          dispute_id,
          a.path_id
        FROM chosen_match_unresolved_disputes_claimants AS a
          INNER JOIN cte_disputes_with_single_path_dir_untrimmable_claimants AS b
            USING (dispute_id)
        WHERE ( a.path_id <> b.path_id )
    ) ;

COMMIT;
