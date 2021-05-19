-- TODO: Add road names and route numbers.
--       However, because of the numerous ways OSM handles them,
--         a user-defined function would probably be appropriate.

INSERT OR IGNORE INTO shst.shst_reference_metadata (
  shst_reference_id,
  geometry_id,
  road_class,
  form_of_way,
  from_intersection_id,
  to_intersection_id,
  shst_ref_length_km,
  is_unidirectional
)
  SELECT DISTINCT
      json_extract(feature, '$.properties.shstReferenceId')     AS shst_reference_id,
      json_extract(feature, '$.properties.geometryId')          AS geometry_id,
      json_extract(feature, '$.properties.roadClass')           AS road_class,
      json_extract(feature, '$.properties.formOfWay')           AS form_of_way,
      json_extract(feature, '$.properties.fromIntersectionId')  AS from_intersection_id,
      json_extract(feature, '$.properties.toIntersectionId')    AS to_intersection_id,
      json_extract(feature, '$.properties.shstReferenceLength') AS shst_ref_length_km,
      json_extract(feature, '$.properties.isUnidirectional')    AS is_unidirectional
    FROM shst.shst_reference_features
;
