/* eslint-disable import/prefer-default-export, no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  SharedStreetsLocationReference,
  SharedStreetsReferenceFeature,
} from '../../domain/types';

function* makeShstReferenceLoaderIterator(
  db: any,
): Generator<SharedStreetsReferenceFeature> {
  const iter = db
    .prepare(
      `
        SELECT
            shst_reference_id,
            shst_geometry_id,
            form_of_way,
            is_forward,
            location_references,
            geom_feature
          FROM (
            SELECT
                ref.id as shst_reference_id,
                geometry_id AS shst_geometry_id,
                fow.value AS form_of_way,
                (geom.forward_reference_id = ref.id) AS is_forward,
                geom.geojson_linestring as geom_feature
              FROM ${SCHEMA}.shst_references AS ref
                INNER JOIN ${SCHEMA}.shst_geometries AS geom
                  ON (geom.id = ref.geometry_id)
                INNER JOIN ${SCHEMA}.shst_reference_forms_of_way AS fow
                  ON (ref.form_of_way = fow.element)
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
        ;
      `,
    )
    .raw()
    .iterate();

  for (const [
    shstReferenceId,
    geometryId,
    formOfWay,
    isForward,
    locationReferencesStr,
    geomFeatureStr,
  ] of iter) {
    const feature = JSON.parse(geomFeatureStr);

    const locationReferences: SharedStreetsLocationReference[] = JSON.parse(
      locationReferencesStr,
    );

    locationReferences.sort((a: any, b: any) => a.sequence - b.sequence);

    const fromIntersectionId = locationReferences[0].intersectionId;

    const toIntersectionId =
      locationReferences[locationReferences.length - 1].intersectionId;

    feature.id = shstReferenceId;

    feature.properties = {
      shstReferenceId,
      geometryId,
      formOfWay,
      fromIntersectionId,
      toIntersectionId,
      locationReferences,
    };

    if (!isForward) {
      feature.geometry.coordinates.reverse();
    }

    yield feature;
  }
}

export default function finishSharedStreetsLoad(db: any) {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

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
    }

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
