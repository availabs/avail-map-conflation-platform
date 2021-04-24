DROP TABLE IF EXISTS awarded_matches;

CREATE TABLE awarded_matches (
  shst_reference_id   INTEGER NOT NULL,

  edge_id             INTEGER NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL,
  section_end         REAL,

  PRIMARY KEY (
    shst_reference_id,
    edge_id
  ),

  CHECK( is_forward BETWEEN 0 AND 1 ),

  -- NULL section_start and section_end means resolution dropped the ChosenMatch.
  CHECK(
    (
      ( section_start IS NOT NULL )
      AND
      ( section_end IS NOT NULL )
    )
    OR
    (
      ( section_start IS NULL )
      AND
      ( section_end IS NULL )
    )
  )

  UNIQUE(
    shst_reference_id,
    section_start
  ),

  UNIQUE(
    shst_reference_id,
    section_end
  )
) WITHOUT ROWID;

CREATE INDEX awarded_matches_shst_ref_idx
  ON awarded_matches(shst_reference_id);

CREATE INDEX awarded_matches_sections_idx
  ON awarded_matches(
    shst_reference_id,
    section_start,
    section_end
  );

CREATE INDEX awarded_matches_edge_idx
  ON awarded_matches (edge_id) ;

