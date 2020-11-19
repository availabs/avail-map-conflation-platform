-- ========== shst_intersections  ==========

DROP TABLE IF EXISTS __SCHEMA__.shst_intersections ;

CREATE TABLE __SCHEMA__.shst_intersections (
  id                TEXT PRIMARY KEY,
  node_id           INTEGER NOT NULL,
  geojson_point     TEXT NOT NULL,  -- GeoJSON Point

  CHECK (json_valid(geojson_point))
) WITHOUT ROWID ;

CREATE INDEX __SCHEMA__.shst_intersections_node_idx
  ON shst_intersections(node_id) ;

-- The GeoPoly Spatial Index

DROP TABLE IF EXISTS __SCHEMA__.shst_intersections_geopoly_idx;

CREATE VIRTUAL TABLE __SCHEMA__.shst_intersections_geopoly_idx
  USING geopoly(id) ;



-- ========== shst_intersections_inbound_references  ==========

DROP TABLE IF EXISTS __SCHEMA__.shst_intersections_inbound_references;

CREATE TABLE __SCHEMA__.shst_intersections_inbound_references (
  shst_intersection_id  TEXT,
  shst_reference_id     TEXT,

  PRIMARY KEY(shst_intersection_id, shst_reference_id),
  FOREIGN KEY (shst_intersection_id)
    REFERENCES shst_intersections(id)
    ON DELETE CASCADE
  --  FOREIGN KEY (shst_reference_id) REFERENCES shst_references(id)
);

CREATE INDEX __SCHEMA__.shst_intersections_inbound_references_ref_id_idx
  ON shst_intersections_inbound_references (shst_reference_id) ;



-- ========== shst_intersections_outbound_references  ==========

DROP TABLE IF EXISTS __SCHEMA__.shst_intersections_outbound_references;

CREATE TABLE __SCHEMA__.shst_intersections_outbound_references (
  shst_intersection_id  TEXT,
  shst_reference_id     TEXT,

  PRIMARY KEY(shst_intersection_id, shst_reference_id),
  FOREIGN KEY (shst_intersection_id)
    REFERENCES shst_intersections(id)
    ON DELETE CASCADE
  --  FOREIGN KEY (shst_reference_id) REFERENCES shst_references(id)
);

CREATE INDEX __SCHEMA__.shst_intersections_outbound_references_ref_id_idx
  ON shst_intersections_outbound_references (shst_reference_id) ;
