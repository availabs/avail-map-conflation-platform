DROP VIEW IF EXISTS __SCHEMA__.target_map_edge_chosen_matches;
DROP TABLE IF EXISTS __SCHEMA__.target_map_paths_edge_optimal_matches;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_edge_id_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches_geopoly_idx ;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_shst_reference_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches;

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
