DROP VIEW IF EXISTS __SCHEMA__.target_map_edge_chosen_matches;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edge_chosen_shst_matches;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_edge_id_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches_geopoly_idx ;
DROP INDEX IF EXISTS __SCHEMA__.target_map_edges_shst_matches_shst_reference_idx ;
DROP TABLE IF EXISTS __SCHEMA__.target_map_edges_shst_matches;

-- TODO: Change shst_reference to shst_reference_id for consistency with SourceMap tables.
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

-- TODO: Change shst_reference to shst_reference_id for consistency with SourceMap tables.
-- TODO: Consider NonEulerian paths. Do we need to add edge_idx?
CREATE TABLE __SCHEMA__.target_map_edge_chosen_shst_matches (
  path_id                 INTEGER NOT NULL,
  path_edge_idx           INTEGER NOT NULL,

  edge_id                 INTEGER NOT NULL,
  is_forward              INTEGER NOT NULL,

  edge_shst_match_idx     INTEGER NOT NULL,

  shst_reference          TEXT NOT NULL,
  section_start           REAL NOT NULL,
  section_end             REAL NOT NULL,

  -- Because of circles and cul-de-sacs, is_forward required in PKey
  -- NOTE: Including shst_reference, without section_start and section_end,
  --         in the PRIMARY KEY enforces that the TargetMapEdge and ShstReference
  --         are both contiguous and atomic because a TMPEdge cannot leave, then return,
  --         to a ShstReference. This means that there are no possible turns within a ShstRef.
  PRIMARY KEY(path_id, path_edge_idx, is_forward, shst_reference),

  CHECK(is_forward BETWEEN 0 AND 1),
  CHECK(edge_shst_match_idx >= 0),
  CHECK(section_start >= 0),
  CHECK(section_start < section_end)
) WITHOUT ROWID ;

CREATE INDEX __SCHEMA__.target_map_edge_chosen_shst_matches_path_edge_idx
  ON target_map_edge_chosen_shst_matches (path_id, path_edge_idx, is_forward) ;

CREATE INDEX __SCHEMA__.target_map_edge_chosen_shst_matches_edge_idx
  ON target_map_edge_chosen_shst_matches (edge_id, is_forward) ;

CREATE INDEX __SCHEMA__.target_map_edge_chosen_shst_matches_shst_ref_sections_idx
  ON target_map_edge_chosen_shst_matches (shst_reference, section_start, section_end) ;
