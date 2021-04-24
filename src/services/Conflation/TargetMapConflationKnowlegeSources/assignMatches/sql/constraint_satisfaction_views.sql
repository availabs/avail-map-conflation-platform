BEGIN;

-- The primary rule: ShstReferenceSections Assignments MUST be EXCLUSIVE.
CREATE VIEW cstrvio_assigned_matches_no_overlaps AS
  SELECT DISTINCT
      a.shst_reference_id,
      a.section_start,
      a.section_end
    FROM assigned_matches_view AS a
      INNER JOIN assigned_matches_view AS b
        USING (shst_reference_id)
    WHERE (
      ( a.edge_id <> b.edge_id ) -- (shst_reference_id, edge_id) is assigned_matches PKEY
      AND
      ( a.section_start < b.section_end )
      AND
      ( b.section_start < a.section_end )
    ) ;

-- Enforces idea that a ShstReference represents a SINGLE direction for a TMEdge.
CREATE VIEW cstrvio_assigned_matches_pkey AS
  SELECT
      shst_reference_id,
      edge_id
    FROM assigned_matches_view
    GROUP BY shst_reference_id, edge_id
    HAVING COUNT(1) > 1 ;

CREATE VIEW cstrvio_assigned_matches_positive_length AS
  SELECT DISTINCT
      shst_reference_id,
      section_start,
      section_end
    FROM assigned_matches_view
    WHERE ( section_end <= section_start ) ;

-- NOTE: These SHOULD be redundant. After proof, remove.
CREATE VIEW cstrvio_assigned_matches_shstref_start_uniq AS
  SELECT
      shst_reference_id,
      section_start
    FROM assigned_matches_view
    GROUP BY shst_reference_id, section_start
    HAVING COUNT(1) > 1 ;

CREATE VIEW cstrvio_assigned_matches_shstref_end_uniq AS
  SELECT
      shst_reference_id,
      section_end
    FROM assigned_matches_view
    GROUP BY shst_reference_id, section_end
    HAVING COUNT(1) > 1 ;

CREATE VIEW constraint_violations_in_assigned_matches AS
  SELECT
      a.*,
      'assigned_matches_no_overlaps' AS rule
    FROM assigned_matches_view AS a
      INNER JOIN cstrvio_assigned_matches_no_overlaps AS b
        USING (shst_reference_id, section_start, section_end)

  UNION ALL

  SELECT
      a.*,
      'assigned_matches_positive_length' AS rule
    FROM assigned_matches_view AS a
      INNER JOIN cstrvio_assigned_matches_positive_length AS b
        USING (shst_reference_id, section_start, section_end)

  UNION ALL

  SELECT
      a.*,
      'assigned_matches_pkey' AS rule
    FROM assigned_matches_view AS a
      INNER JOIN cstrvio_assigned_matches_pkey AS b
        USING (shst_reference_id, edge_id )

  UNION ALL

  SELECT
      a.*,
      'assigned_matches_shstref_start_uniq' AS rule
    FROM assigned_matches_view AS a
      INNER JOIN cstrvio_assigned_matches_shstref_start_uniq AS b
        USING (shst_reference_id, section_start)

  UNION ALL
  SELECT
      a.*,
      'assigned_matches_shstref_end_uniq' AS rule
    FROM assigned_matches_view AS a
      INNER JOIN cstrvio_assigned_matches_shstref_end_uniq AS b
        USING (shst_reference_id, section_end)
;

CREATE VIEW constraint_satisfaction_assigned_matches AS
  SELECT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM assigned_matches_view

  EXCEPT

  SELECT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM constraint_violations_in_assigned_matches ;

COMMIT;
