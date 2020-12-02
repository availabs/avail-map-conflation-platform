DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_geomid_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_from_intxn_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_to_intxn_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_start_pt_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_end_pt_idx ;

DROP VIEW IF EXISTS __SCHEMA__._qa_broken_shst_reference_location_references ;
DROP TABLE IF EXISTS __SCHEMA__.shst_reference_features_geopoly_idx;
DROP TABLE IF EXISTS __SCHEMA__.shst_reference_features ;

-- Because SQLite does not have Materialized Views
CREATE TABLE __SCHEMA__.shst_reference_features (
  shst_reference_id       TEXT NOT NULL PRIMARY KEY,

  geometry_id             TEXT GENERATED ALWAYS
                            AS ( json_extract(feature, '$.properties.geometryId') ) VIRTUAL NOT NULL,
  form_of_way             TEXT GENERATED ALWAYS
                            AS ( json_extract(feature, '$.properties.formOfWay') ) VIRTUAL NOT NULL,
  from_intersection_id    TEXT GENERATED ALWAYS
                            AS ( json_extract(feature, '$.properties.fromIntersectionId') ) VIRTUAL NOT NULL,
  to_intersection_id      TEXT GENERATED ALWAYS
                            AS ( json_extract(feature, '$.properties.toIntersectionId') ) VIRTUAL NOT NULL,

  start_point             TEXT GENERATED ALWAYS
                            AS ( json_extract(feature, '$.geometry.coordinates[0]') ) VIRTUAL NOT NULL,
  end_point               TEXT GENERATED ALWAYS
                            AS ( json_extract(feature, '$.geometry.coordinates[#-1]') ) VIRTUAL NOT NULL,

  location_references     TEXT GENERATED ALWAYS
                            AS ( json_extract(feature, '$.properties.locationReferences') ) VIRTUAL NOT NULL,

  feature                 TEXT NOT NULL,

  CHECK(
    ( shst_reference_id = json_extract(feature, '$.id') )
    AND
    ( shst_reference_id = json_extract(feature, '$.properties.shstReferenceId') )
  ),

  CHECK (
    ( json_array_length(location_references) > 1 )
    AND
    ( json_extract(location_references, '$[0].sequence') = 1 )
    AND
    (
      (
        json_extract(location_references, '$[1].sequence')
          - json_extract(location_references, '$[0].sequence')
      ) = 1
    )
    AND
    (
      (
        json_extract(location_references, '$[#-1].sequence')
          - json_extract(location_references, '$[#-2].sequence')
      ) = 1
    )
  ),

  -- TODO: This CHECK constraint fails. Examine the sharedstreets source code to determine where and why.
  -- CHECK (
  --   ( start_point = json_extract(feature, '$.properties.locationReferences[0].point') )
  --   AND
  --   ( end_point = json_extract(feature, '$.properties.locationReferences[#-1].point') )
  -- ),

  CHECK (
    ( from_intersection_id = json_extract(feature, '$.properties.locationReferences[0].intersectionId') )
    AND
    ( to_intersection_id = json_extract(feature, '$.properties.locationReferences[#-1].intersectionId') )
  )
) WITHOUT ROWID;

CREATE INDEX __SCHEMA__.shst_reference_features_geomid_idx
  ON shst_reference_features (geometry_id);

CREATE INDEX __SCHEMA__.shst_reference_features_from_intxn_idx
  ON shst_reference_features (from_intersection_id);

CREATE INDEX __SCHEMA__.shst_reference_features_to_intxn_idx
  ON shst_reference_features (to_intersection_id);

CREATE INDEX __SCHEMA__.shst_reference_features_start_pt_idx
  ON shst_reference_features (start_point);

CREATE INDEX __SCHEMA__.shst_reference_features_end_pt_idx
  ON shst_reference_features (end_point);

CREATE VIRTUAL TABLE __SCHEMA__.shst_reference_features_geopoly_idx
  USING geopoly(shst_reference_id) ;

CREATE VIEW __SCHEMA__._qa_broken_shst_reference_location_references
  AS
    SELECT
        *
      FROM shst_reference_features
      WHERE (
        ( start_point <> json_extract(feature, '$.properties.locationReferences[0].point') )
        OR
        ( end_point <> json_extract(feature, '$.properties.locationReferences[#-1].point') )
      )
