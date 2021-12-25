DROP TABLE IF EXISTS conflation_map.osm_way_chosen_matches;

CREATE TABLE conflation_map.osm_way_chosen_matches (
  osm_way_id                INTEGER NOT NULL,
  is_forward                INTEGER NOT NULL,

  shst_reference_id         TEXT NOT NULL,

  osm_way_nodes_start_idx   INTEGER NOT NULL,
  osm_way_nodes_end_idx     INTEGER NOT NULL,

  section_start             REAL NOT NULL,
  section_end               REAL NOT NULL,

  PRIMARY KEY(osm_way_id, is_forward, shst_reference_id),

  CHECK(is_forward BETWEEN 0 AND 1),
  CHECK(osm_way_nodes_start_idx >= 0),
  CHECK(osm_way_nodes_end_idx > osm_way_nodes_start_idx),
  CHECK(section_start >= 0),
  CHECK(section_start < section_end)
) WITHOUT ROWID ;

CREATE INDEX conflation_map.osm_way_chosen_matches_way_id_idx
  ON osm_way_chosen_matches (osm_way_id, is_forward) ;

CREATE INDEX conflation_map.osm_way_chosen_matches_shst_ref_sections_idx
  ON osm_way_chosen_matches (shst_reference_id, section_start, section_end) ;
