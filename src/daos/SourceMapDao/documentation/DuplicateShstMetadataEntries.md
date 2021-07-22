# Duplicate Shst Metadata Entries

NOTE: Using New York County 2020

```SQL
SELECT
    COUNT(1)
  FROM (
    SELECT
        geometry_id
      FROM shst_metadata
      GROUP BY 1
      HAVING COUNT(1) > 1
  )
;

-- +----------+
-- | count(1) |
-- +----------+
-- | 235      |
-- +----------+
```

```SQL
WITH cte_meta AS (
  SELECT
      a.geometry_id,
      c.shst_metadata_id,
      c.osm_metadata_way_section_idx,
      c.way_id,
      c.road_class,
      c.one_way,
      c.roundabout,
      c.link,
      c.name,
      d.way_section_nodes_idx,
      d.osm_node_id
    FROM shst_metadata AS a
      INNER JOIN (
        SELECT
            geometry_id
          FROM shst_metadata
          GROUP BY 1
          HAVING COUNT(1) > 1
      ) AS b
        USING (geometry_id)
      INNER JOIN shst_metadata_osm_metadata_way_sections AS c
        ON (a._id = c.shst_metadata_id)
      INNER JOIN shst_metadata_osm_metadata_way_section_nodes AS d
        USING (shst_metadata_id, osm_metadata_way_section_idx)
)
  SELECT EXISTS (
    SELECT 1
      FROM cte_meta AS a
        INNER JOIN cte_meta AS b
          USING (geometry_id, osm_metadata_way_section_idx, way_section_nodes_idx)
      WHERE (
        ( a.shst_metadata_id <> b.shst_metadata_id )
        AND
        (
          ( a.osm_metadata_way_section_idx <> b.osm_metadata_way_section_idx )
          OR
          ( a.way_id <> b.way_id )
          OR
          ( a.road_class <> b.road_class )
          OR
          ( a.one_way <> b.one_way )
          OR
          ( a.roundabout <> b.roundabout )
          OR
          ( a.link <> b.link )
          OR
          ( a.name <> b.name )
          OR
          ( a.osm_node_id <> b.osm_node_id )
        )
      )
  ) AS geom_dupes_have_uniq_metadata

-- +-------------------------------+
-- | geom_dupes_have_uniq_metadata |
-- +-------------------------------+
-- | 0                             |
-- +-------------------------------+
```

```SQL
WITH cte_meta AS (
  SELECT
      a.geometry_id,
      c.shst_metadata_id,
      c.osm_metadata_way_section_idx,
      MAX(d.way_section_nodes_idx) AS max_way_section_nodes_idx
    FROM shst_metadata AS a
      INNER JOIN (
        SELECT
            geometry_id
          FROM shst_metadata
          GROUP BY 1
          HAVING COUNT(1) > 1
      ) AS b
        USING (geometry_id)
      INNER JOIN shst_metadata_osm_metadata_way_sections AS c
        ON (a._id = c.shst_metadata_id)
      INNER JOIN shst_metadata_osm_metadata_way_section_nodes AS d
        USING (shst_metadata_id, osm_metadata_way_section_idx)
)
  SELECT EXISTS (
    SELECT 1
      FROM cte_meta AS a
        INNER JOIN cte_meta AS b
          USING (geometry_id, osm_metadata_way_section_idx)
      WHERE (
        ( a.shst_metadata_id <> b.shst_metadata_id )
        AND
        ( a.max_way_section_nodes_idx <> b.max_way_section_nodes_idx )
      )
  ) AS dupes_have_diff_way_section_lengths

-- +-------------------------------------+
-- | dupes_have_diff_way_section_lengths |
-- +-------------------------------------+
-- | 0                                   |
-- +-------------------------------------+
```

NOTE: The same results hold for the entire state, 2016-2020.

CONCLUSION: Safe to add a UNIQUE CONTRAINT on shst_metadata (geometry_id)
