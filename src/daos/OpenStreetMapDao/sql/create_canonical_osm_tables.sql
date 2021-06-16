-- FIXME: This code does NOT guarantee the PRIMARY KEY CONSTRAINT for osm.canonical_osm_nodes
--          will be satisfied. For all observed nodes, it has not yet failed.
--          Would need to handle the possible transitive equality and make sure we
--          don't move too far from the original node location.
--        Punting for now since that SQL will require some thought.

BEGIN;

DROP TABLE IF EXISTS osm.tmp_osm_highway_nodes ;

CREATE TABLE osm.tmp_osm_highway_nodes (
  osm_way_id      INTEGER NOT NULL,
  osm_node_idx    INTEGER NOT NULL,
  osm_node_id     INTEGER NOT NULL,
  longitude       REAL    NOT NULL,
  latitude        REAL    NOT NULL,
  is_intxn_node   INTEGER NOT NULL,
  way_road_class  INTEGER NOT NULL,

  PRIMARY KEY (osm_way_id, osm_node_idx),

  CHECK (is_intxn_node BETWEEN 0 AND 1),
  CHECK (way_road_class BETWEEN 0 AND 8)

) WITHOUT ROWID ;

INSERT INTO osm.tmp_osm_highway_nodes (
  osm_way_id,
  osm_node_idx,
  osm_node_id,
  longitude,
  latitude,
  is_intxn_node,
  way_road_class
)
  SELECT
      a.osm_way_id,
      b.key AS osm_node_idx,
      b.value AS osm_node_id,
      ROUND(
        json_extract(
          d.coord,
          '$[0]'
        ), 6
      ) AS longitude,
      ROUND(
        json_extract(
          d.coord,
          '$[1]'
        ), 6
      ) AS latitude,
      (
        ( b.key = 0 )
        OR
        ( b.key = (json_array_length(osm_node_ids) - 1) )
      ) AS is_intxn_node,
      c.road_class AS way_road_class

    FROM osm.osm_ways AS a, json_each(osm_node_ids) AS b
      INNER JOIN osm_highway_shst_roadclass AS c
        USING (osm_way_id)
      INNER JOIN osm.osm_nodes AS d
        ON ( b.value = d.osm_node_id )
    ORDER BY a.osm_way_id, b.key
;

CREATE INDEX osm.tmp_osm_highway_nodes_node_id_idx
  ON tmp_osm_highway_nodes (osm_node_id)
;

CREATE INDEX osm.tmp_osm_highway_nodes_coord_idx
  ON tmp_osm_highway_nodes (longitude, latitude)
;

ANALYZE osm.tmp_osm_highway_nodes ;

DROP TABLE IF EXISTS osm.canonical_osm_nodes ;

CREATE TABLE osm.canonical_osm_nodes (
  osm_node_id         INTEGER NOT NULL,
  canonical_node_id   INTEGER NOT NULL,

  PRIMARY KEY (osm_node_id, canonical_node_id)
) WITHOUT ROWID ;

DROP VIEW IF EXISTS osm._qa_canonical_osm_nodes_many_to_one_violations ;

CREATE VIEW osm._qa_canonical_osm_nodes_many_to_one_violations
  AS
    SELECT
        osm_node_id
      FROM canonical_osm_nodes
      GROUP BY osm_node_id
      HAVING COUNT(DISTINCT canonical_node_id) > 1
;

INSERT INTO osm.canonical_osm_nodes (
  osm_node_id,
  canonical_node_id
)
  WITH cte_canonical AS (
    SELECT
        osm_node_id AS canonical_node_id,
        longitude,
        latitude
      FROM (
        SELECT
            osm_node_id,
            longitude,
            latitude,
            RANK() OVER (
              PARTITION BY longitude, latitude
              ORDER BY
                is_intxn_node DESC,  -- Prefer intersection nodes
                way_road_class,      -- Then higher network level way nodes
                osm_node_id          -- Then the lowest number node id
            ) as node_rank
          FROM osm.tmp_osm_highway_nodes
      ) AS t
      WHERE ( node_rank = 1 )
  )
    SELECT DISTINCT
        a.osm_node_id,
        b.canonical_node_id
      FROM osm.tmp_osm_highway_nodes AS a
        INNER JOIN cte_canonical AS b
          USING (longitude, latitude)
      ORDER BY a.osm_node_id
;

ANALYZE osm.canonical_osm_nodes ;

DROP TABLE IF EXISTS osm.tmp_canonical_osm_node_ids_arrays ;

CREATE TABLE osm.tmp_canonical_osm_node_ids_arrays (
  osm_node_ids        TEXT PRIMARY KEY,
  canonical_node_ids  TEXT NOT NULL,

  CHECK( json_type(osm_node_ids) = 'array' ),
  CHECK( json_type(canonical_node_ids) = 'array' ),
  CHECK( json_array_length(osm_node_ids) >= json_array_length(canonical_node_ids) )

) WITHOUT ROWID ;

INSERT INTO osm.tmp_canonical_osm_node_ids_arrays (
  osm_node_ids,
  canonical_node_ids
)
  SELECT DISTINCT
      c.osm_node_ids,
      -- User-defined function that removes immediate repetitions. ( [1,2,2,1] -> [1,2,1] )
      clean_node_ids(
        json_group_array(
          json_object(
            'n', b.canonical_node_id,
            'i', a.osm_node_idx
          )
        )
      ) AS canonical_node_ids
    FROM osm.tmp_osm_highway_nodes AS a
      INNER JOIN osm.canonical_osm_nodes AS b
        USING (osm_node_id)
      INNER JOIN osm.osm_ways AS c
        USING (osm_way_id)
    GROUP BY c.osm_way_id
;

DROP TABLE IF EXISTS osm.osm_way_canonical_node_ids ;
DROP TABLE IF EXISTS osm.canonical_osm_node_ids_arrays ;

CREATE TABLE osm.canonical_osm_node_ids_arrays (
  canonical_node_ids_array_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_node_ids            TEXT NOT NULL,

  CHECK( json_type(canonical_node_ids) = 'array' ),
  CHECK( json_array_length(canonical_node_ids) >= 1 )
) ;

INSERT INTO osm.canonical_osm_node_ids_arrays (
  canonical_node_ids
)
  SELECT DISTINCT
      canonical_node_ids
    FROM osm.tmp_canonical_osm_node_ids_arrays
    ORDER BY 1
;

CREATE INDEX osm.canonical_osm_node_ids_arrays_idx
  ON canonical_osm_node_ids_arrays (canonical_node_ids)
;

ANALYZE osm.canonical_osm_node_ids_arrays ;

DROP TABLE IF EXISTS osm.osm_way_canonical_node_ids ;

CREATE TABLE osm.osm_way_canonical_node_ids (
  osm_way_id                    INTEGER PRIMARY KEY,
  canonical_node_ids_array_id   INTEGER NOT NULL,

  FOREIGN KEY (canonical_node_ids_array_id)
    REFERENCES canonical_osm_node_ids_arrays (canonical_node_ids_array_id)
) WITHOUT ROWID ;

-- https://stackoverflow.com/a/6283762/3970755
-- "an index should be created on the child key columns of each foreign key constraint"

CREATE INDEX osm.osm_way_canonical_node_ids_fkey_idx
  ON osm_way_canonical_node_ids (canonical_node_ids_array_id)
;

INSERT INTO osm.osm_way_canonical_node_ids (
  osm_way_id,
  canonical_node_ids_array_id
)
  SELECT
      a.osm_way_id,
      c.canonical_node_ids_array_id
    FROM osm.osm_ways AS a
      INNER JOIN osm.tmp_canonical_osm_node_ids_arrays AS b
        USING (osm_node_ids)
      INNER JOIN osm.canonical_osm_node_ids_arrays AS c
        USING (canonical_node_ids)
    ORDER BY 1
;

ANALYZE osm.osm_way_canonical_node_ids ;

DROP VIEW IF EXISTS osm.canonical_geospatially_equivalent_osm_ways ;

CREATE VIEW osm.canonical_geospatially_equivalent_osm_ways
  AS
    SELECT
        a.osm_way_id,
        b.osm_way_id AS geospatially_equivalent_osm_way_id
      FROM osm_way_canonical_node_ids AS a
        INNER JOIN osm_way_canonical_node_ids AS b
          USING (canonical_node_ids_array_id)
;

ANALYZE osm.osm_way_canonical_node_ids ;

DROP TABLE osm.tmp_osm_highway_nodes ;
DROP TABLE osm.tmp_canonical_osm_node_ids_arrays ;

COMMIT;
