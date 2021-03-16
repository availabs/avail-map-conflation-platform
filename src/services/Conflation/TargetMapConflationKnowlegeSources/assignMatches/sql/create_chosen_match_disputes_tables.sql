DROP TABLE IF EXISTS tmp_chosen_match_disputed_sections;
DROP TABLE IF EXISTS tmp_chosen_match_dispute_target_map_edges;
DROP TABLE IF EXISTS tmp_chosen_match_dispute_resolutions;
DROP TABLE IF EXISTS tmp_assigned_matches;

-- DROP TABLE IF EXISTS tmp_chosen_match_dispute_shst_references_metadata;

CREATE TABLE tmp_chosen_match_disputed_sections (
  dispute_id               INTEGER NOT NULL PRIMARY KEY,

  shst_geometry_id         TEXT NOT NULL,
  shst_reference_id        TEXT NOT NULL,

  disputed_section_start   REAL NOT NULL,
  disputed_section_end     REAL NOT NULL,

  UNIQUE (
    shst_reference_id,
    disputed_section_start,
    disputed_section_end
  )
) WITHOUT ROWID ;

CREATE TABLE tmp_chosen_match_dispute_claimants (
  dispute_id               INTEGER NOT NULL,

  path_id                  INTEGER NOT NULL,
  path_edge_idx            INTEGER NOT NULL,

  edge_id                  INTEGER NOT NULL,

  is_forward               INTEGER NOT NULL,
  edge_shst_match_idx      INTEGER NOT NULL,

  section_start            REAL NOT NULL,
  section_end              REAL NOT NULL,

  -- If there are disputes within a TMPath direction, there is a problem upstream.
  PRIMARY KEY (
    dispute_id,
    path_id,
    path_edge_idx,
    is_forward
  ),

  FOREIGN KEY ( dispute_id ) REFERENCES tmp_chosen_match_disputed_sections
) WITHOUT ROWID ;

CREATE TABLE tmp_chosen_match_dispute_resolutions (
  shst_reference_id        INTEGER,

  edge_id                  INTEGER,

  section_start            REAL NOT NULL,
  section_end              REAL NOT NULL,

  -- If there are disputes within a TMPath direction, there is a problem upstream.
  PRIMARY KEY (
    shst_reference_id,
    edge_id
  )
) WITHOUT ROWID;

/*
CREATE TABLE tmp_chosen_match_dispute_shst_references_metadata (
  shst_reference_id       TEXT PRIMARY KEY,
  geometry_id             TEXT NOT NULL,
  road_class              INTEGER NOT NULL,
  form_of_way             INTEGER NOT NULL,
  from_intersection_id    TEXT NOT NULL,
  to_intersection_id      TEXT NOT NULL,
  length                  REAL NOT NULL,
  is_unidirectional       INTEGER NOT NULL,

  CHECK(road_class BETWEEN 0 AND 8),
  CHECK(form_of_way BETWEEN 0 AND 7),
  CHECK(length > 0),
  CHECK(is_unidirectional BETWEEN 0 AND 1)
) WITHOUT ROWID;

CREATE INDEX tmp_chosen_match_dispute_shst_references_metadata_geom_idx
  ON tmp_chosen_match_dispute_shst_references_metadata (geometry_id)
;
*/
