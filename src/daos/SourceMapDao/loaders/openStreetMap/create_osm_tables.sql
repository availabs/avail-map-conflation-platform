DROP TABLE IF EXISTS __SCHEMA__.osm_nodes ;

CREATE TABLE __SCHEMA__.osm_nodes (
  osm_node_id         INTEGER PRIMARY KEY,
  coord               TEXT, -- JSON Array: [lon, lat]. Using JSON to preserve exact decimal.
  tags                TEXT  -- JSON Array
) WITHOUT ROWID ;

DROP TABLE IF EXISTS __SCHEMA__.osm_ways ;

CREATE TABLE __SCHEMA__.osm_ways (
  osm_way_id          INTEGER PRIMARY KEY,
  osm_node_ids        TEXT, -- JSON Array
  tags                TEXT  -- JSON Object
) WITHOUT ROWID ;
