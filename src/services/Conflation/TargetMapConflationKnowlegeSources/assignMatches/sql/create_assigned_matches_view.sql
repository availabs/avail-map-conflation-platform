BEGIN;

CREATE VIEW assigned_matches_view
  AS
    WITH RECURSIVE cte_raw_assignments AS (
      SELECT
          a.shst_reference_id,
          a.edge_id,
          a.is_forward,
          a.section_start,
          a.section_end
        FROM chosen_match_initial_undisputed_claims AS a
          LEFT OUTER JOIN discovered_knaves AS b
            ON (
              ( a.shst_reference_id = b.shst_reference_id )
              AND
              ( a.edge_id = b.edge_id )
              AND
              ( a.is_forward = b.is_forward )
              AND
              ( a.section_start < b.section_end )
              AND
              ( b.section_start > a.section_end )
            )
        WHERE ( b.shst_reference_id IS NULL )

      UNION

      SELECT
          shst_reference_id,
          edge_id,
          is_forward,
          section_start,
          section_end
        FROM awarded_matches
  ), cte_assignment_consolidations AS (
    -- RECURSIVE because accumulating sections is transitive.
    SELECT 
        shst_reference_id,
        edge_id,
        is_forward,
        section_start,
        section_end
      FROM cte_raw_assignments
    UNION
    SELECT
        shst_reference_id,
        edge_id,
        is_forward,
        MIN(a.section_start, b.section_start) AS section_start,
        MAX(a.section_end, b.section_end) AS section_end
      FROM cte_raw_assignments AS a
        INNER JOIN cte_assignment_consolidations AS b
          USING( shst_reference_id, edge_id, is_forward )
      WHERE (
        -- Overlap
        (
          ( a.section_start < b.section_end )
          AND
          ( b.section_start < a.section_end )
        )
        OR
        -- Contiguous
        ( ( a.section_end - b.section_start ) < 0.00001 ) -- 1cm
      )
  )
    -- Collect the largest sections created in the recursive query above.
    SELECT DISTINCT
        a.shst_reference_id,
        a.edge_id,
        a.is_forward,
        a.section_start,
        a.section_end
      FROM cte_assignment_consolidations AS a
        LEFT OUTER JOIN cte_assignment_consolidations AS b
          ON (
            ( a.shst_reference_id = b.shst_reference_id )
            AND
            ( a.edge_id = b.edge_id )
            --  AND
            --  ( a.is_forward = b.is_forward )
            AND
            (
              ( a.section_start < b.section_end )
              AND
              ( b.section_start < a.section_end )
            )
            AND
            (
              ( b.section_end - b.section_start ) >= ( a.section_end - a.section_start )
              -- The above doesn't work by itself due to due to Floating Point error.
              AND
              ( -- self join
                ( a.section_start <> b.section_start )
                OR
                ( a.section_end <> b.section_end )
              )
            )
          )
      WHERE ( b.shst_reference_id IS NULL )

  ;

COMMIT;
