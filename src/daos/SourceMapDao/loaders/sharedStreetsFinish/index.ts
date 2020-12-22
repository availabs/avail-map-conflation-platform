/* eslint-disable import/prefer-default-export, no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import {
  SharedStreetsLocationReference,
  SharedStreetsReferenceFeature,
} from '../../domain/types';

export function* makeShstReferenceLoaderIterator(
  db: any,
): Generator<SharedStreetsReferenceFeature> {
  const iter = db
    .prepare(
      `
        SELECT
            shst_reference_id,
            shst_geometry_id,
            form_of_way,
            road_class,
            is_forward,
            location_references,
            geom_feature,
            osm_metadata_way_sections
          FROM (
            SELECT
                ref.id as shst_reference_id,
                geometry_id AS shst_geometry_id,
                fow.value AS form_of_way,
                rc.value AS road_class,
                (geom.forward_reference_id = ref.id) AS is_forward,
                geom.geojson_linestring as geom_feature
              FROM ${SCHEMA}.shst_references AS ref
                INNER JOIN ${SCHEMA}.shst_geometries AS geom
                  ON (geom.id = ref.geometry_id)
                LEFT OUTER JOIN ${SCHEMA}.shst_reference_forms_of_way AS fow
                  ON (ref.form_of_way = fow.element)
                LEFT JOIN ${SCHEMA}.shst_geometry_road_class AS rc
                  ON (geom.road_class = rc.element)
              WHERE (
                ( ref.id = geom.forward_reference_id )
                OR
                ( ref.id = geom.back_reference_id )
              )
            ) INNER JOIN (
              SELECT
                  shst_reference_id,
                  json_group_array(
                    -- JS code must sort the location_references array by the sequence field.
                    json_object(
                      'sequence',
                      location_reference_idx + 1,
                      'point',
                      json_extract(geojson_point, '$.geometry.coordinates'),
                      'bearing',
                      COALESCE(inbound_bearing, outbound_bearing),
                      'distanceToNextRef',
                      distance_to_next_ref,
                      'intersectionId',
                      intersection_id
                    )
                  ) AS location_references
                FROM ${SCHEMA}.shst_references_location_references
                GROUP BY 1
            ) USING (shst_reference_id)
            INNER JOIN (
              SELECT
                  geometry_id AS shst_geometry_id,
                  json_group_array(
                    json_object(
                      'osm_metadata_way_section_idx',
                      osm_metadata_way_section_idx,
                      'way_id',
                      way_id,
                      'osm_way_tags',
                      json(osm_ways.tags),
                      'road_class',
                      road_class,
                      'one_way',
                      one_way,
                      'roundabout',
                      roundabout,
                      'link',
                      link,
                      'name',
                      name
                    )
                  ) AS osm_metadata_way_sections
                FROM ${SCHEMA}.shst_metadata AS meta
                  INNER JOIN ${SCHEMA}.shst_metadata_osm_metadata_way_sections AS way_sections
                    ON (meta._id = way_sections.shst_metadata_id)
                  INNER JOIN ${SCHEMA}.osm_ways
                    ON (way_sections.way_id = osm_ways.osm_way_id)
                GROUP BY geometry_id
            ) USING (shst_geometry_id)
        ;
      `,
    )
    .raw()
    .iterate();

  for (const [
    shstReferenceId,
    geometryId,
    formOfWay,
    roadClass,
    isForward,
    locationReferencesStr,
    geomFeatureStr,
    osmMetadataWaySectionsStr,
  ] of iter) {
    const feature = JSON.parse(geomFeatureStr);

    const locationReferences: SharedStreetsLocationReference[] = JSON.parse(
      locationReferencesStr,
    );

    locationReferences.sort((a: any, b: any) => a.sequence - b.sequence);

    const fromIntersectionId = locationReferences[0].intersectionId;

    const toIntersectionId =
      locationReferences[locationReferences.length - 1].intersectionId;

    const unsortedOsmMetadataWaySections = JSON.parse(
      osmMetadataWaySectionsStr,
    );

    const osmMetadataWaySections = unsortedOsmMetadataWaySections
      .sort(
        (a: any, b: any) =>
          a.osm_metadata_way_section_idx - b.osm_metadata_way_section_idx,
      )
      .map((meta: any) => _.omit(meta, 'osm_metadata_way_section_idx'));

    const osmHighwayTypes = _(osmMetadataWaySections)
      .map('osm_way_tags.highway')
      .filter((t) => t)
      .sort()
      .sortedUniq()
      .value();

    feature.id = shstReferenceId;

    feature.properties = {
      shstReferenceId,
      geometryId,
      formOfWay,
      roadClass,
      fromIntersectionId,
      toIntersectionId,
      locationReferences,
      isForward: !!isForward,
      osmMetadataWaySections,
      // Adding this for convenience and faster queries.
      osmHighwayTypes,
    };

    if (!isForward) {
      feature.geometry.coordinates.reverse();
      feature.properties.osmMetadataWaySections.reverse();
    }

    yield feature;
  }
}

export default function finishSharedStreetsLoad(db: any) {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

  const indxInsertStmt = xdb.prepare(
    `
      INSERT INTO ${SCHEMA}.shst_reference_features_geopoly_idx (
        _shape,
        shst_reference_id
      ) VALUES (?, ?) ;
    `,
  );

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    const sql = readFileSync(join(__dirname, './create_cached_join_tables.sql'))
      .toString()
      .replace(/__SCHEMA__/g, SCHEMA);

    xdb.exec(sql);

    const shstRefInsertStmt = xdb.prepare(
      `
        INSERT INTO ${SCHEMA}.shst_reference_features (
          shst_reference_id,
          feature
        ) VALUES (?, ?)
      ; `,
    );

    const iter = makeShstReferenceLoaderIterator(xdb);

    for (const shstReference of iter) {
      shstRefInsertStmt.run([shstReference.id, JSON.stringify(shstReference)]);

      // Coordinates of the feature's bounding polygon.
      const polyCoords = getBufferPolygonCoords(shstReference);

      const geopolyShape = polyCoords[0];

      indxInsertStmt.run([JSON.stringify(geopolyShape), shstReference.id]);
    }

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
