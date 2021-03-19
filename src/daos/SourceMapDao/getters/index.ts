/* eslint-disable no-restricted-syntax, import/prefer-default-export */

import * as turf from '@turf/turf';

import db from '../../../services/DbService';

import { SOURCE_MAP } from '../../../constants/databaseSchemaNames';
import { SharedStreetsReferenceFeature, OsmNodeId } from '../domain/types';

const getShstReferenceFeaturesOverlappingPolyStmt = db.prepare(
  `
    SELECT
        feature
      FROM ${SOURCE_MAP}.shst_reference_features
        INNER JOIN (
          SELECT
              shst_reference_id
            FROM ${SOURCE_MAP}.shst_reference_features_geopoly_idx
            WHERE geopoly_overlap(_shape, ?)
        ) USING ( shst_reference_id ) ;
  `,
);

const getShstReferenceRoadsOverlappingPolyStmt = db.prepare(
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
      WHERE ( json_extract(feature, '$.properties.minOsmRoadClass') < 8 )
  `,
);

const getShstReferencesStmt = db.prepare(
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
      ORDER BY shst_reference_id ;
  `,
);

// The geopoly types copied from the following:
// https://github.com/Turfjs/turf/blob/3cea4b5f125a11fb4757da59d1222fd837d9783c/packages/turf-invariant/index.ts#L51-L63
export function getShstReferenceFeaturesOverlappingPoly(
  geopoly: any[] | turf.Feature | turf.GeometryObject,
): SharedStreetsReferenceFeature[] {
  const geopolyCoords = turf.getCoords(geopoly);

  const result = getShstReferenceFeaturesOverlappingPolyStmt
    .raw()
    .all([JSON.stringify(geopolyCoords)]);

  const shstRefLineStrings = result.map(([featureStr]) =>
    JSON.parse(featureStr),
  );

  return shstRefLineStrings;
}

export function getShstReferenceRoadsOverlappingPoly(
  geopoly: any[] | turf.Feature | turf.GeometryObject,
): SharedStreetsReferenceFeature[] {
  const geopolyCoords = turf.getCoords(geopoly);

  const result = getShstReferenceRoadsOverlappingPolyStmt
    .raw()
    .all([JSON.stringify(geopolyCoords)]);

  const shstRefLineStrings = result.map(([featureStr]) =>
    JSON.parse(featureStr),
  );

  return shstRefLineStrings;
}

export function getShstReferences(
  shstReferenceIds: SharedStreetsReferenceFeature['id'][],
): SharedStreetsReferenceFeature[] {
  const result = getShstReferencesStmt
    .raw()
    .all([JSON.stringify(shstReferenceIds)]);

  const shstRefLineStrings = result.map(([featureStr]) =>
    JSON.parse(featureStr),
  );

  return shstRefLineStrings;
}

export function getOsmNodes(
  osmNodeIds: OsmNodeId[],
): Record<OsmNodeId, turf.Feature<turf.Point> | null> {
  const nodesById = db
    .prepare(
      `
        SELECT
            osm_node_id,
            coord
          FROM ${SOURCE_MAP}.osm_nodes
            INNER JOIN (
              SELECT
                  value AS osm_node_id
                FROM (
                  SELECT json(?) AS osm_node_ids
                ) AS t, json_each(t.osm_node_ids)
            ) USING (osm_node_id)
      `,
    )
    .raw()
    .all([JSON.stringify(osmNodeIds)])
    .reduce(
      (
        acc: Record<OsmNodeId, turf.Feature<turf.Point>>,
        [osmNodeId, coordStr],
      ) => {
        const coord = JSON.parse(coordStr);
        const node = turf.point(coord, { osmNodeId }, { id: osmNodeId });

        acc[osmNodeId] = node;

        return acc;
      },
      {},
    );

  osmNodeIds.forEach((osmNodeId) => {
    nodesById[osmNodeId] = nodesById[osmNodeId] || null;
  });

  return nodesById;
}
