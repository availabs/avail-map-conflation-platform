BEGIN;

-- CASE:
--        Same TargetMapEdge, different TargetMapPaths.
--          If ChosenShstRefs for a BoundaryTargetMapPathEdges (1st or last for path)
--            differ from ChosenShstRefs for InternalTargetMapPathEdges (not boundary)
--          Then consider the BoundaryTargetMapPathEdge ChosenMatches Knaves.

DROP TABLE IF EXISTS tmp_suspect_boundary_edge_chosen_matches ;

CREATE TABLE tmp_suspect_boundary_edge_chosen_matches AS
  -- All ChosenShstRefs for BoundaryTargetMapPathEdges for which there exists
  --   a corresponding InternalTargetMapPathEdge
  SELECT
      a.edge_id,
      a.shst_reference
    FROM target_map_bb.target_map_edge_chosen_matches AS a
      INNER JOIN target_map_path_last_edge_idx AS b
        ON ( a.path_id = b.path_id )
      INNER JOIN target_map_bb.target_map_edge_chosen_matches AS c
        USING (edge_id)
      INNER JOIN target_map_path_last_edge_idx AS d
        ON ( c.path_id = d.path_id )
    WHERE (
      ( a.path_id != c.path_id )

      AND
      (
        ( a.path_edge_idx = 0 )
        OR
        ( a.path_edge_idx = b.last_edge_idx )
      )

      AND
      (
        ( c.path_edge_idx != 0 )
        AND
        ( c.path_edge_idx != d.last_edge_idx )
      )
    )

  -- Except All ChosenShstRefs for InternalTargetMapPathEdges for the TargetMapEdge
  EXCEPT
  SELECT
      a.edge_id,
      a.shst_reference
    FROM target_map_bb.target_map_edge_chosen_matches AS a
      INNER JOIN target_map_path_last_edge_idx AS b
        ON ( a.path_id = b.path_id )
    WHERE (
      ( a.path_edge_idx != 0 )
      AND
      ( a.path_edge_idx != b.last_edge_idx )
    )
;


INSERT OR IGNORE INTO discovered_knaves (
  shst_reference_id,
  edge_id,
  is_forward,
  section_start,
  section_end
)
  SELECT
      a.shst_reference AS shst_reference_id,
      a.edge_id,
      a.is_forward,
      ROUND(a.section_start, 4) AS section_start,
      ROUND(a.section_end, 4) AS section_end
    FROM target_map_bb.target_map_edge_chosen_matches AS a
      INNER JOIN tmp_suspect_boundary_edge_chosen_matches AS b
      USING (edge_id, shst_reference)
;

DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE (path_id, edge_id) IN (
    SELECT
        a.path_id,
        a.edge_id
      FROM target_map_bb.target_map_edge_chosen_matches AS a
        INNER JOIN tmp_suspect_boundary_edge_chosen_matches AS b
          USING (edge_id, shst_reference)
  )
;

DROP TABLE IF EXISTS tmp_suspect_boundary_edge_chosen_matches ;

-- CASE:
--        Same TargetMapEdge, different TargetMapPaths
--          If ChosenShstRefs for a TargetMapPathEdge are ALL in The TargetMapEdge's ShstMatches,
--            and NONE of the other TargetMapPathEdge's ChosenShstRefs are in the TargetMapPathEdge's ShstMatches
--          Then consider the non-ShstMatch ChosenMatches Knaves.
DROP TABLE IF EXISTS tmp_same_edge_multiple_paths ;

CREATE TABLE tmp_same_edge_multiple_paths AS
  SELECT
      edge_id
    FROM target_map.target_map_ppg_path_edges
    GROUP BY edge_id
    HAVING COUNT(DISTINCT path_id) > 1
;

DROP TABLE IF EXISTS tmp_same_edge_mult_paths_no_shst_chosen_overlaps ;

CREATE TABLE tmp_same_edge_mult_paths_no_shst_chosen_overlaps AS
  SELECT
      path_id,
      edge_id,
      shst_reference
    FROM target_map_bb.target_map_edge_chosen_matches AS a
      INNER JOIN tmp_same_edge_multiple_paths AS b
        USING (edge_id)
      LEFT OUTER JOIN target_map_bb.target_map_edges_shst_matches AS c
        USING (edge_id, shst_reference)
    WHERE ( c.shst_reference IS NULL )
;

DROP TABLE IF EXISTS tmp_same_edge_mult_paths_complete_shst_chosen_overlaps ;

CREATE TABLE tmp_same_edge_mult_paths_complete_shst_chosen_overlaps AS
  SELECT
      path_id,
      edge_id
    FROM target_map_bb.target_map_edge_chosen_matches AS a
      INNER JOIN tmp_same_edge_multiple_paths AS b
        USING (edge_id)
      LEFT OUTER JOIN target_map_bb.target_map_edges_shst_matches AS c
        USING (edge_id, shst_reference)
    GROUP BY path_id, edge_id
    HAVING ( SUM(c.shst_reference IS NOT NULL) = COUNT(1) )
;

INSERT OR IGNORE INTO discovered_knaves (
  shst_reference_id,
  edge_id,
  is_forward,
  section_start,
  section_end
)
  SELECT
      c.shst_reference AS shst_reference_id,
      c.edge_id,
      c.is_forward,
      ROUND(c.section_start, 4) AS section_start,
      ROUND(c.section_end, 4) AS section_end
    FROM tmp_same_edge_mult_paths_no_shst_chosen_overlaps AS a
      INNER JOIN tmp_same_edge_mult_paths_complete_shst_chosen_overlaps AS b
        USING ( edge_id )
      INNER JOIN target_map_bb.target_map_edge_chosen_matches AS c
        USING (edge_id, shst_reference)
;

DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE (dispute_id, path_id, edge_id) IN (
    SELECT
        d.dispute_id,
        a.path_id,
        a.edge_id
      FROM tmp_same_edge_mult_paths_no_shst_chosen_overlaps AS a
        INNER JOIN tmp_same_edge_mult_paths_complete_shst_chosen_overlaps AS b
          USING ( edge_id )
        INNER JOIN target_map_bb.target_map_edge_chosen_matches AS c
          USING (edge_id, shst_reference)
        INNER JOIN chosen_match_unresolved_disputes AS d
          ON ( a.shst_reference = d.shst_reference_id )
  )
;

DROP TABLE IF EXISTS tmp_same_edge_multiple_paths ;
DROP TABLE IF EXISTS tmp_same_edge_mult_paths_no_shst_chosen_overlaps ;
DROP TABLE IF EXISTS tmp_same_edge_mult_paths_complete_shst_chosen_overlaps ;

COMMIT;
