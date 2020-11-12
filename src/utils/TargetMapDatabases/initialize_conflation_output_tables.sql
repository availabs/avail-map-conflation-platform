DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches;

CREATE TABLE IF NOT EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches (
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

DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches_geopoly_idx ;

CREATE VIRTUAL TABLE __SCHEMA_QUALIFIER__target_map_edges_shst_matches_geopoly_idx
  USING geopoly(shst_match_id) ;

DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches_edge_id_idx ;

CREATE INDEX __SCHEMA_QUALIFIER__target_map_edges_shst_matches_edge_id_idx
  ON target_map_edges_shst_matches(edge_id) ;

DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches_shst_reference_idx ;

CREATE INDEX __SCHEMA_QUALIFIER__target_map_edges_shst_matches_shst_reference_idx
  ON target_map_edges_shst_matches(shst_reference) ;


DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains ;

CREATE TABLE IF NOT EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains (
  path_id           INTEGER,
  path_index        INTEGER,
  chain_index       INTEGER,
  chain_edge_index  INTEGER,
  shst_match_id     INTEGER,
  shst_ref_start    REAL,
  shst_ref_end      REAL,

  PRIMARY KEY (path_id, path_index, chain_index, chain_edge_index)
) WITHOUT ROWID ;

DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains_shst_match_id_idx ;

CREATE INDEX __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains_shst_match_id_idx
  ON target_map_paths_shst_match_chains (shst_match_id) ;

DROP VIEW IF EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_matches;

CREATE VIEW __SCHEMA_QUALIFIER__target_map_paths_shst_matches
  AS
    SELECT
        *
      FROM target_map_edges_shst_matches
        INNER JOIN target_map_paths_shst_match_chains
        USING (shst_match_id) ;
