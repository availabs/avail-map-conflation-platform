/*
    TODO: Classification of disputes.
            Views such as trimmable/untrimmable, epsilon_overlap, etc
*/

DROP TABLE IF EXISTS chosen_match_unresolved_disputes_sections;
DROP TABLE IF EXISTS chosen_match_unresolved_disputes_claimants;

-- THESE TABLES ARE IMMUTABLE

CREATE TABLE chosen_match_initial_disputes_sections (
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


CREATE TABLE chosen_match_initial_disputes_claimants (
  dispute_id               INTEGER NOT NULL,
  path_id                  INTEGER NOT NULL,
  path_edge_idx            INTEGER NOT NULL,

  edge_id                  INTEGER NOT NULL,

  is_forward               INTEGER NOT NULL,
  edge_shst_match_idx      INTEGER NOT NULL,

  section_start            REAL NOT NULL,
  section_end              REAL NOT NULL,

  PRIMARY KEY (
    path_id,
    path_edge_idx,
    is_forward,
    edge_shst_match_idx
  ),

  FOREIGN KEY ( dispute_id )
    REFERENCES chosen_match_initial_disputes_sections
    ON DELETE CASCADE
) WITHOUT ROWID ;

CREATE TABLE chosen_match_initial_undisputed_claims (
  path_id                 INTEGER NOT NULL,
  path_edge_idx           INTEGER NOT NULL,

  edge_id                 INTEGER NOT NULL,
  is_forward              INTEGER NOT NULL,

  edge_shst_match_idx     INTEGER NOT NULL,

  shst_reference_id       TEXT NOT NULL,

  section_start           REAL NOT NULL,
  section_end             REAL NOT NULL,

  PRIMARY KEY(
    path_id,
    path_edge_idx,
    is_forward,
    shst_reference_id
  )
) WITHOUT ROWID ;

CREATE INDEX chosen_match_initial_undisputed_claims_idx
  ON chosen_match_initial_undisputed_claims (shst_reference_id, section_start, section_end ) ;

CREATE INDEX chosen_match_initial_undisputed_claims_edge_idx
  ON chosen_match_initial_undisputed_claims (edge_id) ;


-- THE BELOW TABLES ARE MUTABLE

CREATE TABLE chosen_match_unresolved_disputes_sections (
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

CREATE INDEX chosen_match_unresolved_disputes_sections_idx
  ON chosen_match_unresolved_disputes_sections (
    shst_reference_id,
    disputed_section_start,
    disputed_section_end
  ) ;

CREATE TABLE chosen_match_unresolved_disputes_claimants (
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
    REFERENCES chosen_match_unresolved_disputes_sections
    ON DELETE CASCADE
) WITHOUT ROWID ;

CREATE INDEX chosen_match_unresolved_disputes_claimants_edge_idx
  ON chosen_match_unresolved_disputes_claimants (edge_id) ;

-- VIEWS

CREATE VIEW chosen_match_resolved_disputes_sections
  AS
    SELECT
        dispute_id,

        shst_geometry_id,
        shst_reference_id,

        disputed_section_start,
        disputed_section_end
      FROM chosen_match_initial_disputes_sections
    EXCEPT
    SELECT
        dispute_id,

        shst_geometry_id,
        shst_reference_id,

        disputed_section_start,
        disputed_section_end
      FROM chosen_match_unresolved_disputes_sections
  ;

CREATE VIEW chosen_match_resolved_disputes_claimants
  AS
    SELECT
        dispute_id,
        path_id,
        path_edge_idx,

        edge_id,

        is_forward,
        edge_shst_match_idx,

        section_start,
        section_end
      FROM chosen_match_initial_disputes_claimants
    EXCEPT
    SELECT
        dispute_id,
        path_id,
        path_edge_idx,

        edge_id,

        is_forward,
        edge_shst_match_idx,

        section_start,
        section_end
      FROM chosen_match_unresolved_disputes_claimants
  ;

CREATE VIEW chosen_match_initial_disputes
  AS
    SELECT
      dispute_id,

      shst_geometry_id,
      shst_reference_id,

      disputed_section_start,
      disputed_section_end,

      path_id,
      path_edge_idx,

      edge_id,

      is_forward,
      edge_shst_match_idx,

      section_start,
      section_end
    FROM chosen_match_initial_disputes_sections
      INNER JOIN chosen_match_initial_disputes_claimants
        USING ( dispute_id )
  ;

CREATE VIEW chosen_match_unresolved_disputes
  AS
    SELECT
      dispute_id,

      shst_geometry_id,
      shst_reference_id,

      disputed_section_start,
      disputed_section_end,

      path_id,
      path_edge_idx,

      edge_id,

      is_forward,
      edge_shst_match_idx,

      section_start,
      section_end
    FROM chosen_match_unresolved_disputes_sections
      INNER JOIN chosen_match_unresolved_disputes_claimants
        USING ( dispute_id )
  ;

CREATE VIEW chosen_match_resolved_disputes
  AS
    SELECT
      dispute_id,

      shst_geometry_id,
      shst_reference_id,

      disputed_section_start,
      disputed_section_end,

      path_id,
      path_edge_idx,

      edge_id,

      is_forward,
      edge_shst_match_idx,

      section_start,
      section_end
    FROM chosen_match_resolved_disputes_sections
      INNER JOIN chosen_match_resolved_disputes_claimants
        USING ( dispute_id )
  ;

