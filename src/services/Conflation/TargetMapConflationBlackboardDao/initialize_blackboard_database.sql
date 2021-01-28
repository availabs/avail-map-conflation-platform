DROP VIEW IF EXISTS __SCHEMA__.target_map_edge_chosen_matches;
DROP TABLE IF EXISTS __SCHEMA__.target_map_conflation_metadata;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edge_chosen_shst_matches;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_edge_id_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches_geopoly_idx ;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_shst_reference_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches;
DROP TABLE IF EXISTS __SCHEMA__.target_map_ids;

CREATE TABLE __SCHEMA__.target_map_conflation_metadata
  AS
    SELECT json('{}') AS metadata;

-- Serves two purposes.
--   1. If a proper subset of the TargetMap is loaded,
--      edge_ids will vary since they are generated using AUTOINCREMENT.
--      The target_map_ids will remain consistent, however.
--   2. If conflation is run on an induced subnet of the TargetMap,
--      the following is used to filter TargetMapEdges in JOIN queries.
CREATE TABLE IF NOT EXISTS __SCHEMA__.target_map_ids (
  edge_id        INTEGER NOT NULL PRIMARY KEY,
  target_map_id  TEXT NOT NULL
) WITHOUT ROWID ;

-- CREATE TABLE IF NOT EXISTS __SCHEMA__.nearby_target_map_ids (
--   target_map_id  TEXT PRIMARY KEY
-- ) WITHOUT ROWID ;

CREATE TABLE IF NOT EXISTS __SCHEMA__.target_map_edges_shst_matches (
  shst_match_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  edge_id         INTEGER NOT NULL,
  shst_reference  TEXT NOT NULL,
  section_start   REAL NOT NULL,
  section_end     REAL NOT NULL,
  feature_len_km  REAL NOT NULL,
  feature         TEXT NOT NULL,

  UNIQUE (edge_id, shst_reference, section_start, section_end),

  CHECK(section_start >= 0),
  CHECK(section_end > 0),
  CHECK(feature_len_km > 0),

  CHECK(json_valid(feature))
) ;

CREATE VIRTUAL TABLE __SCHEMA__.target_map_edges_shst_matches_geopoly_idx
  USING geopoly(shst_match_id) ;

CREATE INDEX __SCHEMA__.target_map_edges_shst_matches_edge_id_idx
  ON target_map_edges_shst_matches(edge_id) ;

CREATE INDEX __SCHEMA__.target_map_edges_shst_matches_shst_reference_idx
  ON target_map_edges_shst_matches(shst_reference) ;

CREATE TABLE __SCHEMA__.target_map_edge_chosen_shst_matches (
  edge_id                 INTEGER NOT NULL,
  is_forward              INTEGER NOT NULL,
  edge_shst_match_idx     INTEGER NOT NULL,
  shst_reference          TEXT NOT NULL,
  section_start           REAL NOT NULL,
  section_end             REAL NOT NULL,

  PRIMARY KEY(edge_id, shst_reference),

  FOREIGN KEY(edge_id)
    REFERENCES target_map_ids(edge_id),

  CHECK(is_forward BETWEEN 0 AND 1),
  CHECK(edge_shst_match_idx >= 0),
  CHECK(section_start >= 0),
  CHECK(section_start < section_end)
) WITHOUT ROWID ;
