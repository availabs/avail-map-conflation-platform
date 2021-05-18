DROP INDEX IF EXISTS shst.shst_reference_features_geomid_idx ;
DROP INDEX IF EXISTS shst.shst_reference_features_from_intxn_idx ;
DROP INDEX IF EXISTS shst.shst_reference_features_to_intxn_idx ;
DROP INDEX IF EXISTS shst.shst_reference_features_start_pt_idx ;
DROP INDEX IF EXISTS shst.shst_reference_features_end_pt_idx ;
DROP INDEX IF EXISTS shst.shst_reference_features_min_road_class_idx ;

DROP TABLE IF EXISTS shst.shst_reference_features_geopoly_idx;
DROP VIEW IF EXISTS shst._qa_broken_shst_reference_location_references ;

DROP TABLE IF EXISTS shst.shst_reference_features ;
DROP TABLE IF EXISTS shst.shst_reference_roadways_metadata ;

-- Because SQLite does not have Materialized Views
CREATE TABLE shst.shst_reference_features (
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
    json_extract(feature, '$.properties.formOfWay') IN (0, 1, 2, 3, 4, 5, 6, 7)
    AND
    -- https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L33-L44
    json_extract(feature, '$.properties.roadClass') IN (0, 1, 2, 3, 4, 5, 6, 7, 8)
  ),

  CHECK (
    ( json_extract(feature, '$.properties.isForward') IN (0, 1) )
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

CREATE INDEX shst.shst_reference_features_geomid_idx
  ON shst_reference_features ( json_extract(feature, '$.properties.geometryId') );

CREATE INDEX shst.shst_reference_features_from_intxn_idx
  ON shst_reference_features ( json_extract(feature, '$.properties.fromIntersectionId') );

CREATE INDEX shst.shst_reference_features_to_intxn_idx
  ON shst_reference_features ( json_extract(feature, '$.properties.toIntersectionId') );

CREATE INDEX shst.shst_reference_features_min_road_class_idx
  ON shst_reference_features ( json_extract(feature, '$.properties.minOsmRoadClass') );

CREATE INDEX shst.shst_reference_features_start_pt_idx
  ON shst_reference_features ( json_extract(feature, '$.geometry.coordinates[0]') );

CREATE INDEX shst.shst_reference_features_end_pt_idx
  ON shst_reference_features ( json_extract(feature, '$.geometry.coordinates[#-1]') );

CREATE VIRTUAL TABLE shst.shst_reference_features_geopoly_idx
  USING geopoly(shst_reference_id) ;


-- This table is intended to speed up queries that require only the common ShstReference metadata. 
--   Omitting the large OSM Metadata and Geometries increases the density of the relevant information on disk.
--   This table introduces redundancy for performance.
--     * more rows will fit on a disk page, accelerating queries reporting and JOIN operations.
--     * Node will need to parse less JSON (&/or SQLite has less json_extracts to handle)
CREATE TABLE shst.shst_reference_roadways_metadata (
  shst_reference_id       TEXT PRIMARY KEY,
  geometry_id             TEXT    NOT NULL,
  road_class              INTEGER NOT NULL,
  form_of_way             INTEGER NOT NULL,
  from_intersection_id    TEXT    NOT NULL,
  to_intersection_id      TEXT    NOT NULL,
  shst_ref_length         REAL    NOT NULL,
  is_unidirectional       INTEGER NOT NULL,

  CHECK( shst_ref_length > 0 ),
  CHECK( is_unidirectional IN (0, 1) )
) WITHOUT ROWID ;

CREATE INDEX shst.shst_reference_roadways_metadata_geometry_id_idx
  ON shst_reference_roadways_metadata( geometry_id ) ;

CREATE INDEX shst.shst_reference_roadways_metadata_road_class_idx
  ON shst_reference_roadways_metadata( road_class ) ;

CREATE INDEX shst.shst_reference_roadways_metadata_form_of_way_idx
  ON shst_reference_roadways_metadata( form_of_way ) ;

CREATE INDEX shst.shst_reference_roadways_metadata_from_intxn_id_idx
  ON shst_reference_roadways_metadata( from_intersection_id ) ;

CREATE INDEX shst.shst_reference_roadways_metadata_to_intxn_id_idx
  ON shst_reference_roadways_metadata( to_intersection_id ) ;


CREATE VIEW shst._qa_broken_shst_reference_location_references
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
