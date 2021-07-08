-- NOTE: The following tables include a subset of the original table columns.
--       This DOES NOT create a full backup of the original tables.
--       The tables created are for cross-version comparisons.

DROP TABLE IF EXISTS main.conflation_blackboard_snapshot_diff_metadata;

CREATE TABLE main.conflation_blackboard_snapshot_diff_metadata (
  target_map    TEXT NOT NULL,
  a_timestamp   TEXT NOT NULL,
  b_timestamp   TEXT NOT NULL,

  PRIMARY KEY(target_map, a_timestamp, b_timestamp)
) WITHOUT ROWID ;


-- ========== Shst Matches ==========

DROP TABLE IF EXISTS main.shst_matches_a_except_b ;

CREATE TABLE main.shst_matches_a_except_b (
  shst_match_id       INTEGER PRIMARY KEY,
  edge_id             INTEGER NOT NULL,
  shst_reference      TEXT NOT NULL,
  section_start       REAL NOT NULL,
  section_end         REAL NOT NULL
) WITHOUT ROWID ;

INSERT INTO main.shst_matches_a_except_b (
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
    FROM a.target_map_edges_shst_matches

  EXCEPT

  SELECT
      shst_match_id,
      edge_id,
      shst_reference,
      section_start,
      section_end
    FROM b.target_map_edges_shst_matches
;

CREATE INDEX main.shst_matches_a_except_b_edge_id_idx
  ON shst_matches_a_except_b(edge_id) ;

CREATE INDEX main.shst_matches_a_except_b_shst_reference_idx
  ON shst_matches_a_except_b(shst_reference) ;


DROP TABLE IF EXISTS main.shst_matches_b_except_a ;

CREATE TABLE main.shst_matches_b_except_a (
  shst_match_id       INTEGER PRIMARY KEY,
  edge_id             INTEGER NOT NULL,
  shst_reference      TEXT NOT NULL,
  section_start       REAL NOT NULL,
  section_end         REAL NOT NULL
) WITHOUT ROWID ;

INSERT INTO main.shst_matches_b_except_a (
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
    FROM b.target_map_edges_shst_matches

  EXCEPT

  SELECT
      shst_match_id,
      edge_id,
      shst_reference,
      section_start,
      section_end
    FROM a.target_map_edges_shst_matches
;

CREATE INDEX main.shst_matches_b_except_a_edge_id_idx
  ON shst_matches_b_except_a(edge_id) ;

CREATE INDEX main.shst_matches_b_except_a_shst_reference_idx
  ON shst_matches_b_except_a(shst_reference) ;


DROP TABLE IF EXISTS main.shst_matches_a_intersect_b ;

CREATE TABLE main.shst_matches_a_intersect_b (
  shst_match_id       INTEGER PRIMARY KEY,
  edge_id             INTEGER NOT NULL,
  shst_reference      TEXT NOT NULL,
  section_start       REAL NOT NULL,
  section_end         REAL NOT NULL
) WITHOUT ROWID ;

INSERT INTO main.shst_matches_a_intersect_b (
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
    FROM a.target_map_edges_shst_matches

  INTERSECT

  SELECT
      shst_match_id,
      edge_id,
      shst_reference,
      section_start,
      section_end
    FROM b.target_map_edges_shst_matches
;

CREATE INDEX main.shst_matches_a_intersect_b_edge_id_idx
  ON shst_matches_a_intersect_b(edge_id) ;

CREATE INDEX main.shst_matches_a_intersect_b_shst_reference_idx
  ON shst_matches_a_intersect_b(shst_reference) ;


-- ========== Chosen Matches ==========

DROP TABLE IF EXISTS main.chosen_matches_a_except_b ;

CREATE TABLE main.chosen_matches_a_except_b (
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

INSERT INTO main.chosen_matches_a_except_b (
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
    FROM a.target_map_edge_chosen_matches

  EXCEPT

  SELECT
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,
      edge_shst_match_idx,
      shst_reference,
      section_start,
      section_end
    FROM b.target_map_edge_chosen_matches
;

CREATE INDEX main.chosen_matches_a_except_b_path_edge_idx
  ON chosen_matches_a_except_b (path_id, path_edge_idx, is_forward) ;

CREATE INDEX main.chosen_matches_a_except_b_edge_idx
  ON chosen_matches_a_except_b (edge_id, is_forward) ;

CREATE INDEX main.chosen_matches_a_except_b_ref_sections_idx
  ON chosen_matches_a_except_b (shst_reference, section_start, section_end) ;


DROP TABLE IF EXISTS main.chosen_matches_b_except_a ;

CREATE TABLE main.chosen_matches_b_except_a (
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

INSERT INTO main.chosen_matches_b_except_a (
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
    FROM b.target_map_edge_chosen_matches

  EXCEPT

  SELECT
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,
      edge_shst_match_idx,
      shst_reference,
      section_start,
      section_end
    FROM a.target_map_edge_chosen_matches
;

CREATE INDEX main.chosen_matches_b_except_a_path_edge_idx
  ON chosen_matches_b_except_a (path_id, path_edge_idx, is_forward) ;

CREATE INDEX main.chosen_matches_b_except_a_edge_idx
  ON chosen_matches_b_except_a (edge_id, is_forward) ;

CREATE INDEX main.chosen_matches_b_except_a_ref_sections_idx
  ON chosen_matches_b_except_a (shst_reference, section_start, section_end) ;


DROP TABLE IF EXISTS main.chosen_matches_a_intersect_b ;

CREATE TABLE main.chosen_matches_a_intersect_b (
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

INSERT INTO main.chosen_matches_a_intersect_b (
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
    FROM a.target_map_edge_chosen_matches

  INTERSECT

  SELECT
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,
      edge_shst_match_idx,
      shst_reference,
      section_start,
      section_end
    FROM b.target_map_edge_chosen_matches
;

CREATE INDEX main.chosen_matches_a_intersect_b_path_edge_idx
  ON chosen_matches_a_intersect_b (path_id, path_edge_idx, is_forward) ;

CREATE INDEX main.chosen_matches_a_intersect_b_edge_idx
  ON chosen_matches_a_intersect_b (edge_id, is_forward) ;

CREATE INDEX main.chosen_matches_a_intersect_b_ref_sections_idx
  ON chosen_matches_a_intersect_b (shst_reference, section_start, section_end) ;

-- ========== Assigned Matches ==========

DROP TABLE IF EXISTS main.assigned_matches_a_except_b;

CREATE TABLE main.assigned_matches_a_except_b (
  shst_reference_id   INTEGER NOT NULL,

  edge_id             INTEGER NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL,
  section_end         REAL,

  PRIMARY KEY (
    shst_reference_id,
    edge_id
  )
) WITHOUT ROWID;

INSERT INTO main.assigned_matches_a_except_b (
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
    FROM a.target_map_edge_assigned_matches

  EXCEPT

  SELECT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM b.target_map_edge_assigned_matches
;

CREATE INDEX main.assigned_matches_a_except_b_edge_idx
  ON assigned_matches_a_except_b (edge_id, is_forward) ;

CREATE INDEX main.assigned_matches_a_except_b_ref_sections_idx
  ON assigned_matches_a_except_b (shst_reference_id, section_start, section_end) ;


DROP TABLE IF EXISTS main.assigned_matches_b_except_a;

CREATE TABLE main.assigned_matches_b_except_a (
  shst_reference_id   INTEGER NOT NULL,

  edge_id             INTEGER NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL,
  section_end         REAL,

  PRIMARY KEY (
    shst_reference_id,
    edge_id
  )
) WITHOUT ROWID;

INSERT INTO main.assigned_matches_b_except_a (
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
    FROM b.target_map_edge_assigned_matches

  EXCEPT

  SELECT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM a.target_map_edge_assigned_matches
;

CREATE INDEX main.assigned_matches_b_except_a_edge_idx
  ON assigned_matches_b_except_a (edge_id, is_forward) ;

CREATE INDEX main.assigned_matches_b_except_a_ref_sections_idx
  ON assigned_matches_b_except_a (shst_reference_id, section_start, section_end) ;


DROP TABLE IF EXISTS main.assigned_matches_a_intersect_b;

CREATE TABLE main.assigned_matches_a_intersect_b (
  shst_reference_id   INTEGER NOT NULL,

  edge_id             INTEGER NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL,
  section_end         REAL,

  PRIMARY KEY (
    shst_reference_id,
    edge_id
  )
) WITHOUT ROWID;

INSERT INTO main.assigned_matches_a_intersect_b (
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
    FROM a.target_map_edge_assigned_matches

  INTERSECT

  SELECT
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end
    FROM b.target_map_edge_assigned_matches
;

CREATE INDEX main.assigned_matches_a_intersect_b_edge_idx
  ON assigned_matches_a_intersect_b (edge_id, is_forward) ;

CREATE INDEX main.assigned_matches_a_intersect_b_ref_sections_idx
  ON assigned_matches_a_intersect_b (shst_reference_id, section_start, section_end) ;
