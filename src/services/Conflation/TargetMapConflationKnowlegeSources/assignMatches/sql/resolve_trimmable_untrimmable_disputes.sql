-- TODO: Delete from trimmable boundaries inward to preserve contiguousness

-- NOTE: ??? Add actual section_start and section_end mutations ???

BEGIN;

-- If there is a single untrimmable in a dispute, it wins.
--   Single path may have multiple untrimmable sections in a dispute.
--     If there is a single path with untrimmables in the dispute,
--       then all untrimmables for that path win their section.
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
        -- NOTE: ShstRefences are directional, so is_forward should be consistent for a TargetMapPath.
        --       If is_forward is inconsistent, that's a red flag.
        CAST(path_id AS TEXT)
        || '|'
        || CAST(a.is_forward AS TEXT)
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

-- Untrimmables beat trimmables.
DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE (dispute_id, path_id, path_edge_idx, edge_id ) IN (
    SELECT
        sub_trimmables.dispute_id,
        sub_trimmables.path_id,
        sub_trimmables.path_edge_idx,
        sub_trimmables.edge_id
      FROM (
        SELECT
            dispute_id,
            path_id,
            path_edge_idx,
            edge_id,
            is_forward,
            section_start,
            section_end
          FROM chosen_match_unresolved_disputes_claimants AS x
            INNER JOIN disputed_chosen_match_trimmability AS y
              USING (
                path_id,
                path_edge_idx,
                is_forward,
                edge_shst_match_idx
              )
          WHERE ( y.start_trimmable AND y.end_trimmable )
      ) AS sub_trimmables INNER JOIN (
        SELECT
            dispute_id,
            path_id,
            path_edge_idx,
            edge_id,
            is_forward,
            section_start,
            section_end
          FROM chosen_match_unresolved_disputes_claimants AS x
            INNER JOIN disputed_chosen_match_trimmability AS y
              USING (
                path_id,
                path_edge_idx,
                is_forward,
                edge_shst_match_idx
              )
          WHERE ( NOT ( y.start_trimmable OR y.end_trimmable ) )
        ) AS sub_untrimmables USING ( dispute_id )
      WHERE (
        ( sub_trimmables.section_start < sub_untrimmables.section_end )
        AND
        ( sub_untrimmables.section_start < sub_trimmables.section_end )
      )
  ) ;

COMMIT;
