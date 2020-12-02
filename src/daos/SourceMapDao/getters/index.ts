/* eslint-disable no-restricted-syntax, import/prefer-default-export */

import * as turf from '@turf/turf';

import db from '../../../services/DbService';

import { SOURCE_MAP } from '../../../constants/databaseSchemaNames';
import { SharedStreetsReferenceFeature } from '../domain/types';

export function getShstReferenceFeaturesOverlappingPoly(
  geopoly: turf.Feature<turf.Polygon>,
): turf.Feature<turf.LineString>[] {
  const geopolyCoords = turf.getCoords(geopoly);

  const result = db
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
      `,
    )
    .raw()
    .all([JSON.stringify(geopolyCoords)]);

  const shstRefLineStrings = result.map(([featureStr]) =>
    JSON.parse(featureStr),
  );

  return shstRefLineStrings;
}

export function getShstReferences(
  shstReferenceIds: SharedStreetsReferenceFeature['id'][],
) {
  const result = db
    .prepare(
      `
        SELECT
            feature
          FROM ${SOURCE_MAP}.shst_reference_features
          WHERE shst_reference_id IN (
            SELECT
                value
              FROM (
                  SELECT json(?) AS shst_ref_ids_arr
                ) AS t, json_each(t.shst_ref_ids_arr)
          )
          ORDER BY shst_reference_id ; `,
    )
    .raw()
    .all([JSON.stringify(shstReferenceIds)]);

  const shstRefLineStrings = result.map(([featureStr]) =>
    JSON.parse(featureStr),
  );

  return shstRefLineStrings;
}
