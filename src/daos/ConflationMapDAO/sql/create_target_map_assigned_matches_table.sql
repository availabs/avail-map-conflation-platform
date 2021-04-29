DROP TABLE IF EXISTS conflation_map.target_maps_assigned_matches;

CREATE TABLE conflation_map.target_maps_assigned_matches (
  shst_reference_id   INTEGER NOT NULL,

  target_map          TEXT NOT NULL,
  target_map_id       TEXT NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL NOT NULL,
  section_end         REAL NOT NULL,

  PRIMARY KEY (
    shst_reference_id,
    target_map,
    target_map_id
  ),

  CHECK( is_forward BETWEEN 0 AND 1 ),

  UNIQUE(
    shst_reference_id,
    target_map,
    section_start
  ),

  UNIQUE(
    shst_reference_id,
    target_map,
    section_end
  )
) WITHOUT ROWID;
