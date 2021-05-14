DROP TABLE IF EXISTS osm.osm_nodes ;
DROP TABLE IF EXISTS osm.osm_ways ;

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
