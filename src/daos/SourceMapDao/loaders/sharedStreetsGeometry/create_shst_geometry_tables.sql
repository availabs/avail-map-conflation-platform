DROP TABLE IF EXISTS __SCHEMA__.shst_geometries ;

CREATE TABLE __SCHEMA__.shst_geometries (
    id                      TEXT NOT NULL,

    from_intersection_id    TEXT,
    to_intersection_id      TEXT,

    forward_reference_id    TEXT,
    back_reference_id       TEXT,

    road_class              TEXT,

    geojson_linestring      TEXT,

    PRIMARY KEY (id, forward_reference_id, back_reference_id)
  ) WITHOUT ROWID;

CREATE INDEX __SCHEMA__.shst_geometries_from_intersection_idx
  ON shst_geometries (from_intersection_id) ;

CREATE INDEX __SCHEMA__.shst_geometries_to_intersection_idx
  ON shst_geometries (to_intersection_id) ;

CREATE INDEX __SCHEMA__.shst_geometries_forward_ref_idx
  ON shst_geometries (forward_reference_id) ;

CREATE INDEX __SCHEMA__.shst_geometries_back_ref_idx
  ON shst_geometries (back_reference_id) ;

-- Create a spatial index on the geometry
DROP TABLE IF EXISTS __SCHEMA__.shst_geometries_geopoly_idx;

CREATE VIRTUAL TABLE __SCHEMA__.shst_geometries_geopoly_idx
  USING geopoly(id) ;
