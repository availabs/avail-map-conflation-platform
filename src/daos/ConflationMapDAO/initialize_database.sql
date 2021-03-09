DROP TABLE IF EXISTS __SCHEMA__.osm_ways_to_shst_references;
DROP TABLE IF EXISTS __SCHEMA__.osm_way_chosen_shst_matches;

CREATE TABLE __SCHEMA__.osm_ways_to_shst_references (
  osm_way_id          INTEGER NOT NULL,
  shst_reference_id   TEXT NOT NULL,

  PRIMARY KEY(osm_way_id, shst_reference_id)
) WITHOUT ROWID;

CREATE INDEX __SCHEMA__.osm_ways_to_shst_references_shst_ref_idx
  ON osm_ways_to_shst_references (shst_reference_id);

CREATE TABLE __SCHEMA__.osm_way_chosen_shst_matches (
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

-- CREATE INDEX __SCHEMA__.osm_way_chosen_shst_matches_way_id_idx
--   ON osm_way_chosen_shst_matches (osm_way_id, is_forward) ;
--
-- CREATE INDEX __SCHEMA__.osm_way_chosen_shst_matches_shst_ref_sections_idx
--   ON osm_way_chosen_shst_matches (shst_reference_id, section_start, section_end) ;
