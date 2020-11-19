/*
  See https://github.com/sharedstreets/sharedstreets-ref-system
*/

DROP VIEW IF EXISTS __SCHEMA__.shst_reference_features ;

CREATE VIEW __SCHEMA__.shst_reference_features
  AS
    SELECT
        ref.id as shst_reference_id,
        geometry_id AS shst_geometry_id,
        fow.value AS form_of_way,
        (geom.forward_reference_id = ref.id) AS is_forward,
        geom.geojson_linestring as feature
      FROM __SCHEMA__.shst_references AS ref
        INNER JOIN __SCHEMA__.shst_geometries AS geom
          ON (geom.id = ref.geometry_id)
        INNER JOIN __SCHEMA__.shst_reference_forms_of_way AS fow
          ON (ref.form_of_way = fow.element)
      WHERE (
        ( ref.id = geom.forward_reference_id )
        OR
        ( ref.id = geom.back_reference_id )
      ) ;
;

DROP VIEW IF EXISTS __SCHEMA__.shst_references_location_references_json;

CREATE VIEW __SCHEMA__.shst_references_location_references_json
  AS
    SELECT
        shst_reference_id,
        json_group_array(
          -- JS code must sort the location_references array by the sequence field.
          json_object(
            'sequence',
            location_reference_idx + 1,
            'lon',
            json_extract(geojson_point, '$.geometry.coordinates[0]'),
            'lat',
            json_extract(geojson_point, '$.geometry.coordinates[1]'),
            'inboundBearing',
            inbound_bearing,
            'outboundBearing',
            outbound_bearing,
            'distanceToNextRef',
            distance_to_next_ref
          )
        ) AS location_references
      FROM __SCHEMA__.shst_references_location_references
      GROUP BY 1 ;
