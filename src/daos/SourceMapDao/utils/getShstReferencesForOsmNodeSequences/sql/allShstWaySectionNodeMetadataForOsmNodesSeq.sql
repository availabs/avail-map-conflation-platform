WITH cte_osm_nodes_seq AS (
  SELECT
      value AS osm_node_id,
      key AS osm_node_seq_idx
    FROM json_each(?)
), cte_osm_way_section_nodes AS (
  SELECT
      d.geometry_id AS shst_geometry_id,
      c.way_id AS osm_way_id,
      b.osm_metadata_way_section_idx,
      b.way_section_nodes_idx,
      b.osm_node_id,
      a.osm_node_seq_idx
    FROM cte_osm_nodes_seq AS a
      INNER JOIN shst.shst_metadata_osm_metadata_way_section_nodes AS b
        USING ( osm_node_id )
      INNER JOIN shst.shst_metadata_osm_metadata_way_sections AS c
        USING( shst_metadata_id, osm_metadata_way_section_idx )
      INNER JOIN shst.shst_metadata AS d
        ON ( c.shst_metadata_id = d._id )
)
  SELECT DISTINCT
      a.shst_geometry_id,
      a.osm_way_id,
      a.osm_metadata_way_section_idx,
      a.way_section_nodes_idx,
      a.osm_node_id,
      a.osm_node_seq_idx
    FROM cte_osm_way_section_nodes AS a
      INNER JOIN cte_osm_way_section_nodes AS b
        USING (shst_geometry_id, osm_metadata_way_section_idx)
    WHERE (
      --  Must have two adjacent nodes to pass filter.
      --    Using absolute value includes first/last nodes.
      ( ABS( a.osm_node_seq_idx - b.osm_node_seq_idx ) = 1 )
      AND
      ( ABS( a.way_section_nodes_idx - b.way_section_nodes_idx ) = 1 )
    )
    ORDER BY a.osm_node_seq_idx
;
