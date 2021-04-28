-- NOTE: Rounding should use same precision as in ../utils/loadChosenMatchDisputes.ts

/*
    Potential Use Cases:
      * ReverseDirection
      * Upstream/Downstream roadClass arbitration method
      * Rotaries isForward flipping to consolidate and satisfy AssignedMatch PKEY
*/

BEGIN;

CREATE TEMPORARY VIEW shst_reference_metadata
  AS
    SELECT
        a.shst_reference_id,
        json_extract(a.feature, '$.properties.geometryId') AS geometry_id,
        ROUND(
          json_extract(a.feature, '$.properties.shstReferenceLength'),
          4
        ) AS shst_ref_length,
        json_extract(a.feature, '$.properties.roadClass') AS road_class,
        json_extract(a.feature, '$.properties.formOfWay') AS form_of_way,
        json_extract(a.feature, '$.properties.fromIntersectionId') AS from_intersection_id,
        json_extract(a.feature, '$.properties.toIntersectionId') AS to_intersection_id,
        json_extract(a.feature, '$.properties.isUnidirectional') AS is_unidirectional,

        CASE a.shst_reference_id
          WHEN b.forward_reference_id THEN b.back_reference_id
          WHEN b.back_reference_id THEN b.forward_reference_id
        END AS reverse_shst_reference_id

      FROM source_map.shst_reference_features AS a
        INNER JOIN source_map.shst_geometries AS b
          ON ( json_extract(a.feature, '$.properties.geometryId') = b.id )
  ;

COMMIT;
