DROP TABLE IF EXISTS chosen_match_disputed_sections;
DROP TABLE IF EXISTS chosen_match_dispute_claimants;

-- DROP TABLE IF EXISTS chosen_match_dispute_shst_references_metadata;

CREATE TABLE chosen_match_disputed_sections (
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

CREATE TABLE chosen_match_dispute_claimants (
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

  FOREIGN KEY ( dispute_id )
    REFERENCES chosen_match_disputed_sections
    ON DELETE CASCADE
) WITHOUT ROWID ;
