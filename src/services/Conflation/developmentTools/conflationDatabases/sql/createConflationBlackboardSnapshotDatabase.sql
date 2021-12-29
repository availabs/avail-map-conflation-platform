-- NOTE: The following tables include a subset of the original table columns.
--       This DOES NOT create a full backup of the original tables.
--       The tables created are for cross-version comparisons.

BEGIN;

DROP TABLE IF EXISTS main.conflation_blackboard_snapshot_metadata;

CREATE TABLE main.conflation_blackboard_snapshot_metadata (
  target_map  TEXT NOT NULL,
  timestamp   TEXT NOT NULL,

  PRIMARY KEY(target_map, timestamp)
) WITHOUT ROWID ;

DROP TABLE IF EXISTS main.target_map_edges_shst_matches ;

CREATE TABLE main.target_map_edges_shst_matches (
  shst_match_id       INTEGER PRIMARY KEY,
  edge_id             INTEGER NOT NULL,
  shst_reference      TEXT NOT NULL,
  section_start       REAL NOT NULL,
  section_end         REAL NOT NULL
) WITHOUT ROWID ;

INSERT INTO main.target_map_edges_shst_matches (
  shst_match_id,
  edge_id,
  shst_reference,
  section_start,
  section_end
)
  SELECT
      shst_match_id,
      edge_id,
      shst_reference,
      section_start,
      section_end
    FROM tmap_blkbrd.target_map_edges_shst_matches
;

CREATE INDEX main.target_map_edges_shst_matches_edge_id_idx
  ON target_map_edges_shst_matches(edge_id) ;

CREATE INDEX main.target_map_edges_shst_matches_shst_reference_idx
  ON target_map_edges_shst_matches(shst_reference) ;

DROP TABLE IF EXISTS main.target_map_edge_chosen_matches ;

CREATE TABLE main.target_map_edge_chosen_matches (
  path_id                 INTEGER NOT NULL,
  path_edge_idx           INTEGER NOT NULL,

  edge_id                 INTEGER NOT NULL,
  is_forward              INTEGER NOT NULL,

  edge_shst_match_idx     INTEGER NOT NULL,

  shst_reference          TEXT NOT NULL,

  section_start           REAL NOT NULL,
  section_end             REAL NOT NULL,

  PRIMARY KEY(
    path_id,
    path_edge_idx,
    is_forward,
    shst_reference
  )
) WITHOUT ROWID ;

INSERT INTO main.target_map_edge_chosen_matches (
  path_id,
  path_edge_idx,
  edge_id,
  is_forward,
  edge_shst_match_idx,
  shst_reference,
  section_start,
  section_end
)
  SELECT
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,
      edge_shst_match_idx,
      shst_reference,
      section_start,
      section_end
    FROM tmap_blkbrd.target_map_edge_chosen_matches
;

CREATE INDEX main.target_map_edge_chosen_matches_path_edge_idx
  ON target_map_edge_chosen_matches (path_id, path_edge_idx, is_forward) ;

CREATE INDEX main.target_map_edge_chosen_matches_edge_idx
  ON target_map_edge_chosen_matches (edge_id, is_forward) ;

CREATE INDEX main.target_map_edge_chosen_matches_ref_sections_idx
  ON target_map_edge_chosen_matches (shst_reference, section_start, section_end) ;


DROP TABLE IF EXISTS main.target_map_edge_assigned_matches;

CREATE TABLE main.target_map_edge_assigned_matches (
  shst_reference_id   TEXT NOT NULL,

  edge_id             INTEGER NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL,
  section_end         REAL,

  PRIMARY KEY (
    shst_reference_id,
    edge_id
  )
) WITHOUT ROWID;

INSERT INTO main.target_map_edge_assigned_matches (
  shst_reference_id,
  edge_id,
  is_forward,
  section_start,
  section_end

)
  SELECT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM tmap_blkbrd.target_map_edge_assigned_matches
;


CREATE INDEX main.target_map_edge_assigned_matches_edge_idx
  ON target_map_edge_assigned_matches (edge_id, is_forward) ;

CREATE INDEX main.target_map_edge_assigned_matches_ref_sections_idx
  ON target_map_edge_assigned_matches (shst_reference_id, section_start, section_end) ;

COMMIT;

VACUUM main;

