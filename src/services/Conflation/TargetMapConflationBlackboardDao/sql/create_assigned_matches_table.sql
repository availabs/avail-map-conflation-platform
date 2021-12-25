DROP TABLE IF EXISTS __SCHEMA__.target_map_edge_assigned_matches;

CREATE TABLE __SCHEMA__.target_map_edge_assigned_matches (
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
