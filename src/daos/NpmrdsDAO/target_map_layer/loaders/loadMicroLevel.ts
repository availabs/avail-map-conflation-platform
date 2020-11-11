/* eslint-disable no-restricted-syntax */

import { Database } from 'better-sqlite3';
import * as turf from '@turf/turf';

import db from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import { Coordinate } from '../../../../domain';

import TargetMapDAO, {
  PreloadedTargetMapNode,
  PreloadedTargetMapEdge,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

export function* makeNodesIterator(
  xdb: Database,
): Generator<PreloadedTargetMapNode> {
  const tmcNodesIterator = xdb
    .prepare(
      `
        SELECT
            start_longitude AS lon,
            start_latitude AS lat
          FROM tmc_identification
        UNION -- Removes Dupes
        SELECT
            end_longitude AS lon,
            end_latitude AS lat
          FROM tmc_identification
        -- To make deterministic
        ORDER BY 1, 2 ;`,
    )
    .iterate();

  for (const { lon, lat } of tmcNodesIterator) {
    yield {
      lon,
      lat,
      properties: null,
    };
  }
}

export function* makeEdgesIterator(
  xdb: Database,
): Generator<PreloadedTargetMapEdge> {
  const tmcsIterator = xdb
    .prepare(
      `
        SELECT
            feature
          FROM raw_target_map_features 
          ORDER BY target_map_id ;`,
    )
    .raw()
    .iterate();

  // Cannot do in database using SQL because we need to compute GeoProx keys
  //   The alternative it to iterate over the table while simultaneously mutating it.
  for (const [featureStr] of tmcsIterator) {
    const feature: NpmrdsTmcFeature = JSON.parse(featureStr);

    const {
      id: tmc,
      properties: {
        start_latitude,
        start_longitude,
        end_latitude,
        end_longitude,
      },
    } = feature;

    const properties = { targetMapId: tmc };

    const startCoord: Coordinate = [start_longitude, start_latitude];
    const endCoord: Coordinate = [end_longitude, end_latitude];

    const coordinates = turf.getCoords(feature);

    yield {
      startCoord,
      endCoord,
      properties,
      coordinates,
    };
  }
}

// eslint-disable-next-line import/prefer-default-export
export default async function loadMicroLevel() {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    const targetMapDao = new TargetMapDAO(xdb, SCHEMA);

    targetMapDao.initializeTargetMapDatabase();

    // Load Nodes
    const nodesIterator = makeNodesIterator(xdb);

    for (const node of nodesIterator) {
      targetMapDao.insertNode(node);
    }

    console.log('NPMRDS Target Map PPG nodes loaded.');

    // Load Edges
    const edgesIterator = makeEdgesIterator(xdb);

    for (const edge of edgesIterator) {
      targetMapDao.insertEdge(edge);
    }

    console.log('NPMRDS Target Map PPG edges loaded.');

    // Cannot do in database using SQL because we need to compute GeoProx keys
    //   The alternative it to iterate over the table while simultaneously mutating it.
    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
