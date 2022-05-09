/*
  NOTE: This SQL script depends on the following user defined functions:
        
          * json_array_prepend
          * json_array_includes
          * json_array_num_sort
*/

BEGIN ;

DROP TABLE IF EXISTS osm.osm_roadway_routes_hierarchy ;

CREATE TABLE osm.osm_roadway_routes_hierarchy
  AS
    WITH RECURSIVE cte_routes_hierarchy AS (
      -- The Leaves are the OSM Ways
      SELECT
          r.osm_route_id,
          json_array(r.osm_route_id) AS path,
          json_array(m.key) AS member_indexes,
          m.value->>'id' AS member_osm_id,
          'way' AS member_type,
          0 as cycle
        FROM osm.osm_route_relations AS r,
          json_each(members) AS m
        WHERE (
          ( r.tags->>'type' = 'route' )
          AND
          ( r.tags->>'route' = 'road' )
          AND
          ( m.value->>'type' = 'way' )
        )
      UNION ALL
      SELECT
          r.osm_route_id,
          -- NOTE: The way's path and index are included in the first iteration.
          json_array_prepend(h.path, r.osm_route_id) AS path,
          json_array_prepend(h.member_indexes, m.key) AS member_indexes,
          m.value->>'id' AS member_osm_id,
          'relation' AS member_type,
          json_array_includes(h.path, m.value->>'id') AS cycle
        FROM osm.osm_route_relations AS r,
          json_each(members) AS m
          INNER JOIN cte_routes_hierarchy AS h
            ON (m.value->>'id' = h.osm_route_id)
        WHERE (
          ( NOT h.cycle )
          AND
          ( r.tags->>'type' = 'route' )
          AND
          ( r.tags->>'route' IN ( 'road', 'bus' ) )
          AND
          ( m.value->>'type' = 'relation' )
        )
    )
      SELECT
          osm_route_id,
          path AS routes_hierarchy_path,
          member_indexes AS routes_members_indexes,
          member_osm_id AS osm_way_id
        FROM cte_routes_hierarchy
        WHERE (member_type = 'way')

      UNION ALL

      SELECT
          r.osm_route_id,
          r.path AS routes_hierarchy_path,
          r.member_indexes AS routes_members_indexes,
          w.member_osm_id AS osm_way_id
        FROM cte_routes_hierarchy AS w -- The lowest inner node in the tree, right above the ways/leaves.
          INNER JOIN cte_routes_hierarchy AS r -- The inner nodes of the routes hierarchy tree.
            ON (
              ( json_extract(w.path, '$[0]') = json_extract(r.path, '$[#-1]') )
              AND
              ( json_extract(w.member_indexes, '$[0]') = json_extract(r.member_indexes, '$[#-1]') )
            )
        WHERE (
          (w.member_type = 'way')
          AND
          (r.member_type = 'relation')
        )
;

DROP TABLE IF EXISTS osm.osm_routes_metadata ;

CREATE TABLE osm.osm_routes_metadata
  AS 
    WITH cte_routes_hierarchy_paths AS (
      SELECT DISTINCT
          routes_hierarchy_path,
          value AS osm_route_id,
          key AS path_idx
        FROM osm.osm_roadway_routes_hierarchy,
          json_each(routes_hierarchy_path)
    ), cte_routes_parents AS (
      SELECT DISTINCT
          a.osm_route_id,
          json_array_num_sort(
            NULLIF(
              json_group_array(
                b.osm_route_id
              ),
              json_array()
            )
          ) AS parent_routes
        FROM cte_routes_hierarchy_paths AS a
          INNER JOIN cte_routes_hierarchy_paths AS b
            USING (routes_hierarchy_path)
        WHERE (a.path_idx > b.path_idx)
        GROUP BY a.osm_route_id
    ), cte_routes_children AS (
      SELECT DISTINCT
          a.osm_route_id,
          json_array_num_sort(
            NULLIF(
              json_group_array(
                b.osm_route_id
              ),
              json_array()
            )
          ) AS child_routes
        FROM cte_routes_hierarchy_paths AS a
          INNER JOIN cte_routes_hierarchy_paths AS b
            USING (routes_hierarchy_path)
        WHERE (a.path_idx < b.path_idx)
        GROUP BY a.osm_route_id
    )
    SELECT
        osm_route_id,
        NULLIF(a.tags->>'name', '') AS name,
        NULLIF(a.tags->>'network', '') AS network,
        NULLIF(a.tags->>'ref', '') AS ref,
        NULLIF(
          UPPER(a.tags->>'direction'),
          ''
        ) AS direction,
        NULLIF(a.tags->>'operator', '') AS operator,
        (b.parent_routes IS NULL) AS is_root_route,
        parent_routes,
        child_routes,
        a.tags->>'route' AS route_type
      FROM osm.osm_route_relations AS a
        LEFT OUTER JOIN cte_routes_parents AS b
          USING (osm_route_id)
        LEFT OUTER JOIN cte_routes_children AS c
          USING (osm_route_id)
      WHERE ( a.tags->>'route' IN ('road', 'bus') )
;

DROP VIEW IF EXISTS osm.osm_roadway_routes_metadata ;
CREATE VIEW osm.osm_roadway_routes_metadata
  AS
    SELECT
        *
      FROM osm_routes_metadata
      WHERE ( route_type = 'road' )
;

DROP VIEW IF EXISTS osm.osm_bus_routes_metadata ;
CREATE VIEW osm.osm_bus_routes_metadata
  AS
    SELECT
        *
      FROM osm_routes_metadata
      WHERE ( route_type = 'bus' )
;

COMMIT ;
