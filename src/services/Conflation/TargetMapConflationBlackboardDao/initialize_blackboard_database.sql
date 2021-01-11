DROP VIEW IF EXISTS __SCHEMA__.target_map_edge_chosen_matches;
DROP TABLE IF EXISTS __SCHEMA__.target_map_paths_edge_optimal_matches;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_edge_id_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches_geopoly_idx ;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_shst_reference_idx ;
DROP INDEX IF EXISTS __SCHEMA__.target_map_paths_shst_match_chains_shst_match_id_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches;
DROP TABLE IF EXISTS __SCHEMA__.target_map_paths_shst_match_chains ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_paths_shst_match_chains_metadata ;

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


-- NOTE: This table should be used to CASCADE DELETEs to target_map_paths_shst_match_chains.
CREATE TABLE IF NOT EXISTS __SCHEMA__.target_map_paths_shst_match_chains_metadata (
  path_id   INTEGER NOT NULL PRIMARY KEY,
  metadata  TEXT NOT NULL,

  CHECK(json_valid(metadata))
) WITHOUT ROWID ;

CREATE TABLE IF NOT EXISTS __SCHEMA__.target_map_paths_shst_match_chains (
  -- Foreign Key referencing the target_map_ppg_path_edge table.
  path_id              INTEGER NOT NULL,
  path_edge_idx        INTEGER NOT NULL,

  -- Each path edge can have mutiple matches chains (when there are spatial gaps in matches).
  --  * edge_chain_idx represents the topological ordering of match chains along the edge.
  --  * edge_chain_link_idx represents the ordering of matches withing the matches chain.
  edge_chain_idx       INTEGER NOT NULL,
  edge_chain_link_idx  INTEGER NOT NULL,

  -- Foreign Key referencing the target_map_edges_shst_matches table.
  shst_match_id        INTEGER NOT NULL,

  PRIMARY KEY (path_id, path_edge_idx, edge_chain_idx, edge_chain_link_idx),

  FOREIGN KEY(path_id)
    REFERENCES target_map_paths_shst_match_chains_metadata(path_id)
    ON DELETE CASCADE,

  FOREIGN KEY(shst_match_id)
    REFERENCES target_map_edges_shst_matches(shst_match_id)
    ON DELETE CASCADE
) WITHOUT ROWID ;

CREATE INDEX __SCHEMA__.target_map_paths_shst_match_chains_shst_match_id_idx
  ON target_map_paths_shst_match_chains (shst_match_id) ;

CREATE TABLE __SCHEMA__.target_map_paths_edge_optimal_matches (
  path_id               INTEGER NOT NULL,
  path_edge_idx         INTEGER NOT NULL,
  edge_chain_idx        INTEGER NOT NULL,
  edge_chain_link_idx   INTEGER NOT NULL,

  PRIMARY KEY (path_id, path_edge_idx, edge_chain_idx, edge_chain_link_idx),

  FOREIGN KEY(
      path_id,
      path_edge_idx,
      edge_chain_idx,
      edge_chain_link_idx
    )
    REFERENCES target_map_paths_shst_match_chains(
      path_id,
      path_edge_idx,
      edge_chain_idx,
      edge_chain_link_idx
    ) ON DELETE CASCADE
) WITHOUT ROWID ;

CREATE VIEW __SCHEMA__.target_map_edge_chosen_matches
  AS
    SELECT
        path_id,
        path_edge_idx,
        edge_id,
        edge_chain_idx,
        edge_chain_link_idx,
        shst_match_id,
        shst_reference,
        section_start,
        section_end,
        feature_len_km,
        feature
      FROM target_map_paths_edge_optimal_matches
        INNER JOIN target_map_paths_shst_match_chains
          USING (path_id, path_edge_idx, edge_chain_idx, edge_chain_link_idx)
        INNER JOIN target_map_edges_shst_matches
          USING (shst_match_id) ;
