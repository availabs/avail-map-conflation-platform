DROP TABLE IF EXISTS shst.shst_tileset_provenance ;

-- Should contain a single row with the
--   * tile_source: OSM planet version id. Used to set HOME ENV for ShstMatcher.
--   * shst_builder_version: https://github.com/sharedstreets/sharedstreets-builder
CREATE TABLE shst.shst_tileset_provenance (
  tile_source           TEXT PRIMARY KEY NOT NULL,
  shst_builder_version  TEXT NOT NULL
) WITHOUT ROWID ;
