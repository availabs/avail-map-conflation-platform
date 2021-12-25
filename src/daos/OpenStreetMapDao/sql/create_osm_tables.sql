DROP TABLE IF EXISTS osm.osm_version ;
DROP TABLE IF EXISTS osm.osm_nodes ;
DROP TABLE IF EXISTS osm.osm_ways ;

CREATE TABLE osm.osm_version (
  osm_version   TEXT PRIMARY KEY
) ;

CREATE TRIGGER osm.osm_version_insert_trig
  BEFORE INSERT ON osm_version
  BEGIN
    SELECT
      CASE
        WHEN (
          ( SELECT EXISTS ( SELECT 1 FROM osm_nodes ) )
          OR
          ( SELECT EXISTS ( SELECT 1 FROM osm_ways ) )
        ) THEN RAISE (
          FAIL,
          'The osm_version table CANNOT be modified while the osm_nodes and/or osm_ways tables have data.'
        )
      END;
  END;

CREATE TABLE osm.osm_nodes (
  osm_node_id         INTEGER PRIMARY KEY,
  coord               TEXT, -- JSON Array: [lon, lat]. Using JSON to preserve exact decimal.
  tags                TEXT  -- JSON Array
) WITHOUT ROWID ;

CREATE TABLE osm.osm_ways (
  osm_way_id          INTEGER PRIMARY KEY,
  osm_node_ids        TEXT, -- JSON Array
  tags                TEXT  -- JSON Object
) WITHOUT ROWID ;
