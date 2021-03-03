/* eslint-disable no-restricted-syntax, import/prefer-default-export */

import * as turf from '@turf/turf';

import db from '../../../services/DbService';

import { getGeometriesConcaveHull } from '../../../utils/gis/hulls';

import { SOURCE_MAP } from '../../../constants/databaseSchemaNames';

import {
  SharedStreetsReferenceFeature,
  SharedStreetsIntersectionFeature,
  SharedStreetsRoadClass,
} from '../domain/types';

export function* makeSharedStreetsReferenceFeaturesIterator(): Generator<
  SharedStreetsReferenceFeature
> {
  const shstReferencesIter = db
    .prepare(
      `
        SELECT
            feature
          FROM ${SOURCE_MAP}.shst_reference_features
          ORDER BY shst_reference_id
        ; `,
    )
    .raw()
    .iterate();

  for (const [featureStr] of shstReferencesIter) {
    const feature = JSON.parse(featureStr);

    yield feature;
  }
}

export function* makeSharedStreetsReferenceFeaturesOverlappingPolygonIterator(
  boundaryPolygon: turf.Feature<turf.Polygon>,
): Generator<SharedStreetsReferenceFeature> {
  const boundingPolyHull = getGeometriesConcaveHull([boundaryPolygon]);
  const [boundingPolyCoords] = turf.getCoords(boundingPolyHull);

  const shstReferencesIter = db
    .prepare(
      `
        SELECT
            feature
          FROM ${SOURCE_MAP}.shst_reference_features
            INNER JOIN (
              SELECT
                  shst_reference_id
                FROM ${SOURCE_MAP}.shst_reference_features_geopoly_idx
                WHERE geopoly_overlap(_shape, ?)
            ) USING ( shst_reference_id )
          ORDER BY shst_reference_id
        ; `,
    )
    .raw()
    .iterate([JSON.stringify(boundingPolyCoords)]);

  for (const [featureStr] of shstReferencesIter) {
    const feature = JSON.parse(featureStr);

    yield feature;
  }
}

export function* makeShstIntersectionsWithMinRoadClassIter(): Generator<
  SharedStreetsIntersectionFeature & { roadClass: SharedStreetsRoadClass }
> {
  const shstIntersectionsWithMinRoadClassIter = db
    .prepare(
      `
        SELECT
            json_set(
              MIN(geojson_point),
              '$.properties.roadClass',
              json( MIN(roadClass) )
            ) AS feature
          FROM ${SOURCE_MAP}.shst_intersections AS shst_intxns
            INNER JOIN (
              SELECT
                  json_extract(feature, '$.properties.fromIntersectionId') AS id,
                  CAST( json_extract(feature, '$.properties.minOsmRoadClass') AS INTEGER ) AS roadClass
                FROM ${SOURCE_MAP}.shst_reference_features
              UNION ALL
              SELECT
                  json_extract(feature, '$.properties.toIntersectionId') AS id,
                  CAST( json_extract(feature, '$.properties.minOsmRoadClass') AS INTEGER ) AS roadClass
                FROM ${SOURCE_MAP}.shst_reference_features
            ) USING (id)
          GROUP BY id
          ORDER BY CAST( json_extract(feature, '$.properties.minOsmRoadClass') AS INTEGER )
        ;
      `,
    )
    .raw()
    .iterate();

  console.warn(
    'WARNING: The shstIntersectionsWithMinRoadClassIter query takes over 10 minutes to run.',
  );

  for (const [featureStr] of shstIntersectionsWithMinRoadClassIter) {
    const feature = JSON.parse(featureStr);

    yield feature;
  }
}
