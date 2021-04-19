WITH cte_max_claim_length AS (
  SELECT
      dispute_id,
      MAX(section_end - section_start) AS max_section_len
    FROM chosen_match_dispute_claimants
    GROUP BY dispute_id
)
  DELETE FROM chosen_match_dispute_claimants
    -- FIXME: need to go by edges, not paths
    WHERE (dispute_id, path_id) IN (
      SELECT
          dispute_id,
          a.path_id
        FROM chosen_match_dispute_claimants AS a
          INNER JOIN cte_max_claim_length AS b
            USING (dispute_id)
        WHERE (
          ( ( a.section_end - a.section_start ) / b.max_section_len ) < 0.1
        )
    ) ;
