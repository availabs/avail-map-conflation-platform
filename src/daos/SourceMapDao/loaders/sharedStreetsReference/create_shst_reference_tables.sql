/*
  See https://github.com/sharedstreets/sharedstreets-ref-system#sharedstreets-references

  SharedStreets References (SSR) are directional edges in a road network.

  Each SharedStreets Reference consists of two or more location references (LRs)
  that describe the latitude and longitude of the beginning or end of a street segment.

  For long segments LRs are repeated every 15km, segments shorter than 15km have
  only a beginning and end LR.  LRs describe the compass bearing of the street
  geometry for the 20 meters immediately following the LR. The final LR of a SSR
  does not provide a bearing.

  NOTE: Bearings give you an embedded graph.
        https://en.wikipedia.org/wiki/Rotation_system
*/



-- ========== shst_references  ==========

DROP TABLE IF EXISTS __SCHEMA__.shst_references ;

CREATE TABLE __SCHEMA__.shst_references (
  id            TEXT PRIMARY KEY,
  geometry_id   TEXT,
  form_of_way   TEXT
) WITHOUT ROWID ;

CREATE INDEX __SCHEMA__.shst_references_geom_idx
  ON shst_references (geometry_id) ;

DROP TABLE IF EXISTS __SCHEMA__.shst_references_geopoly_idx;

CREATE VIRTUAL TABLE __SCHEMA__.shst_references_geopoly_idx
  USING geopoly(id) ;



-- ========== shst_references_location_references  ==========
--
-- Normalizes SharedStreetsReference.locationReferences: LocationReference[]

DROP TABLE IF EXISTS __SCHEMA__.shst_references_location_references ;

-- FOREIGN KEY (intersection_id) REFERENCES shst_intersections(id)
CREATE TABLE __SCHEMA__.shst_references_location_references (
  shst_reference_id        TEXT,
  location_reference_idx   INTEGER,

  intersection_id          TEXT NOT NULL,

  inbound_bearing          REAL,
  outbound_bearing         REAL,
  distance_to_next_ref     REAL, -- centimeters

  -- lon, lat combined into GeoJSON Point
  geojson_point            TEXT NOT NULL, -- GeoJSON Point

  PRIMARY KEY (shst_reference_id, location_reference_idx),
  FOREIGN KEY (shst_reference_id)
    REFERENCES shst_references(id)
    ON DELETE CASCADE
) WITHOUT ROWID;

CREATE INDEX __SCHEMA__.shst_location_references_shst_ref_id_idx
  ON shst_references_location_references (shst_reference_id) ;

CREATE INDEX __SCHEMA__.shst_location_references_intxn_id_idx
  ON shst_references_location_references (intersection_id) ;



-- ========== shst_reference_forms_of_way  ==========

DROP TABLE IF EXISTS __SCHEMA__.shst_reference_forms_of_way ;

CREATE TABLE __SCHEMA__.shst_reference_forms_of_way
  AS
    SELECT
        column1 AS element,
        column2 as value
      FROM (
        VALUES
          ('Undefined',            0),
          ('Motorway',             1),
          ('MultipleCarriageway',  2),
          ('SingleCarriageway',    3),
          ('Roundabout',           4),
          ('TrafficSquare',        5),
          ('SlipRoad',             6),
          ('Other',                7)
      )
;



-- ========== shst_references_location_references_geopoly_idx  ==========

DROP TABLE IF EXISTS __SCHEMA__.shst_references_location_references_geopoly_idx;

CREATE VIRTUAL TABLE __SCHEMA__.shst_references_location_references_geopoly_idx
  USING geopoly(shst_reference_id, location_reference_idx) ;
