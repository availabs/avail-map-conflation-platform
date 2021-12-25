BEGIN;

DROP TABLE IF EXISTS tmp_path_assigned_matches_road_class_analysis ;

CREATE TABLE tmp_path_assigned_matches_road_class_analysis
  AS
    WITH cte_path_total_assigned_length AS (
      SELECT
          path_id,
          SUM( section_end - section_start ) AS total_km
        FROM target_map.target_map_ppg_path_edges
          INNER JOIN assigned_matches_view
            USING (edge_id)
          INNER JOIN shst_reference_metadata
            USING (shst_reference_id)
        GROUP BY path_id
    )
      SELECT
          path_id,
          road_class,
          SUM( section_end - section_start ) AS total_road_class_km,
          ROUND(
            (
              SUM( section_end - section_start )
              / total_km
            ), 4
          ) AS ratio_road_class
        FROM target_map.target_map_ppg_path_edges
          INNER JOIN assigned_matches_view
            USING (edge_id)
          INNER JOIN shst_reference_metadata
            USING (shst_reference_id)
          INNER JOIN cte_path_total_assigned_length
            USING (path_id)
        GROUP BY path_id, road_class ;

/*
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

DROP TABLE IF EXISTS tmp_edge_level_match_info ;

CREATE TABLE tmp_edge_level_match_info
  AS
    SELECT
        a.path_id,
        a.path_edge_idx,

        a.edge_id,
        b.target_map_id,

        a.is_forward,
        a.edge_shst_match_idx,

        ROUND(a.section_start, 4) AS section_start,
        ROUND(a.section_end, 4) AS section_end,

        c.shst_reference_id,
        c.road_class,

        d.start_trimmable,
        d.end_trimmable
      FROM target_map_bb.target_map_edge_chosen_matches AS a
        INNER JOIN target_map.target_map_ppg_edge_id_to_target_map_id AS b
          USING (edge_id)
        INNER JOIN shst_reference_metadata AS c
          ON ( a.shst_reference = c.shst_reference_id )
        INNER JOIN disputed_chosen_match_trimmability AS d
          USING (
            path_id,
            path_edge_idx,
            is_forward,
            edge_shst_match_idx
          )
;

DROP TABLE IF EXISTS tmp_road_class_flagged_possible_knaves ;

CREATE TABLE tmp_road_class_flagged_possible_knaves
  AS
    SELECT
        *
      FROM tmp_path_assigned_matches_road_class_analysis AS a
        INNER JOIN tmp_edge_level_match_info AS b
          USING (
            path_id,
            road_class
          )
      WHERE (
        ( ratio_road_class < 0.03 )
        AND
        ( total_road_class_km < 0.01 )
        AND
        ( start_trimmable AND end_trimmable )
      )
;

/*
  > \d discovered_knaves
  +-----+-------------------+---------+---------+------------+----+
  | cid | name              | type    | notnull | dflt_value | pk |
  +-----+-------------------+---------+---------+------------+----+
  | 0   | shst_reference_id | TEXT    | 1       | <null>     | 1  |
  | 1   | edge_id           | INTEGER | 1       | <null>     | 2  |
  | 2   | is_forward        | INTEGER | 1       | <null>     | 3  |
  | 3   | section_start     | REAL    | 1       | <null>     | 4  |
  | 4   | section_end       | REAL    | 1       | <null>     | 5  |
  +-----+-------------------+---------+---------+------------+----+
*/

INSERT OR IGNORE INTO discovered_knaves
  SELECT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM tmp_road_class_flagged_possible_knaves ;

DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE (dispute_id, edge_id) IN (
    SELECT
        a.dispute_id,
        a.edge_id
      FROM chosen_match_unresolved_disputes AS a
        INNER JOIN discovered_knaves AS b
          USING (edge_id, is_forward)
      WHERE (
        ( a.section_start < b.section_end )
        AND
        ( b.section_start < a.section_end )
      )
  ) ;

-- TODO: Use to settle disputes.

COMMIT;
