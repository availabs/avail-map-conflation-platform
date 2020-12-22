DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_geomid_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_from_intxn_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_to_intxn_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_start_pt_idx ;
DROP INDEX IF EXISTS __SCHEMA__.shst_reference_features_end_pt_idx ;

DROP TABLE IF EXISTS __SCHEMA__.shst_reference_features_geopoly_idx;
DROP VIEW IF EXISTS __SCHEMA__._qa_broken_shst_reference_location_references ;

DROP TABLE IF EXISTS __SCHEMA__.shst_reference_features ;

-- Because SQLite does not have Materialized Views
CREATE TABLE __SCHEMA__.shst_reference_features (
  shst_reference_id       TEXT NOT NULL PRIMARY KEY,

  feature                 TEXT NOT NULL,

  CHECK(
    ( shst_reference_id = json_extract(feature, '$.id') )
    AND
    ( shst_reference_id = json_extract(feature, '$.properties.shstReferenceId') )
  ),

  CHECK (
    ( json_array_length(
        json_extract(feature, '$.properties.locationReferences')
      ) > 1
    )
    AND
    (
      json_extract(
        json_extract(feature, '$.properties.locationReferences'),
        '$[0].sequence'
      ) = 1
    )
    AND
    (
      (
        json_extract(
          json_extract(feature, '$.properties.locationReferences'),
          '$[1].sequence'
        ) -
        json_extract(
          json_extract(feature, '$.properties.locationReferences'),
          '$[0].sequence'
        )
      ) = 1
    )
    AND
    (
      (
        json_extract(
          json_extract(feature, '$.properties.locationReferences'),
          '$[#-1].sequence'
        ) -
        json_extract(
          json_extract(feature, '$.properties.locationReferences'),
          '$[#-2].sequence'
        )
      ) = 1
    )
  )

  CHECK (
    (
      json_extract(feature, '$.properties.fromIntersectionId')
        = json_extract(feature, '$.properties.locationReferences[0].intersectionId')
    )
    AND
    (
      json_extract(feature, '$.properties.toIntersectionId')
        = json_extract(feature, '$.properties.locationReferences[#-1].intersectionId')
    )
  ),

  CHECK (
    -- https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L173-L186
    json_extract(feature, '$.properties.formOfWay') BETWEEN 0 AND 7
    AND
    -- https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L33-L44
    json_extract(feature, '$.properties.roadClass') BETWEEN 0 AND 8
  ),

  CHECK (
    ( json_extract(feature, '$.properties.isForward') = 1 )
    OR
    ( json_extract(feature, '$.properties.isForward') = 0 )
  ),

  CHECK (
    ( json_array_length(
        json_extract(feature, '$.properties.osmMetadataWaySections')
      ) > 0
    )
  ),

  CHECK (
    ( json_array_length(
        json_extract(feature, '$.properties.osmHighwayTypes')
      ) > 0
    )
  )
) WITHOUT ROWID;

CREATE INDEX __SCHEMA__.shst_reference_features_geomid_idx
  ON shst_reference_features ( json_extract(feature, '$.properties.geometryId') );

CREATE INDEX __SCHEMA__.shst_reference_features_from_intxn_idx
  ON shst_reference_features ( json_extract(feature, '$.properties.fromIntersectionId') );

CREATE INDEX __SCHEMA__.shst_reference_features_to_intxn_idx
  ON shst_reference_features ( json_extract(feature, '$.properties.toIntersectionId') );

CREATE INDEX __SCHEMA__.shst_reference_features_start_pt_idx
  ON shst_reference_features ( json_extract(feature, '$.geometry.coordinates[0]') );

CREATE INDEX __SCHEMA__.shst_reference_features_end_pt_idx
  ON shst_reference_features ( json_extract(feature, '$.geometry.coordinates[#-1]') );

CREATE VIRTUAL TABLE __SCHEMA__.shst_reference_features_geopoly_idx
  USING geopoly(shst_reference_id) ;

CREATE VIEW __SCHEMA__._qa_broken_shst_reference_location_references
  AS
    SELECT
        *
      FROM shst_reference_features
      WHERE (
        (
          json_extract(feature, '$.geometry.coordinates[0]')
            <> json_extract(feature, '$.properties.locationReferences[0].point')
        )
        OR
        (
          json_extract(feature, '$.geometry.coordinates[#-1]')
            <> json_extract(feature, '$.properties.locationReferences[#-1].point')
        )
      ) ;
