/* eslint-disable no-restricted-syntax */

import { Database } from 'better-sqlite3';
import * as turf from '@turf/turf';

import db from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO, {
  PreloadedTargetMapEdge,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

import lineMerge from '../../../../utils/gis/lineMerge';

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

    const { id: tmc } = feature;

    const mergedLineStrings = lineMerge(feature).sort(
      (a, b) => turf.length(b) - turf.length(a),
    );

    const [longestLineString] = mergedLineStrings;

    const longestLineStringCoords = turf.getCoords(longestLineString);
    const [start_longitude, start_latitude] = longestLineStringCoords[0];
    const [end_longitude, end_latitude] = longestLineStringCoords[
      longestLineStringCoords.length - 1
    ];

    const properties = { targetMapId: tmc };

    const startCoord: turf.Position = [start_longitude, start_latitude];
    const endCoord: turf.Position = [end_longitude, end_latitude];

    const coordinates =
      mergedLineStrings.length === 1
        ? longestLineStringCoords
        : mergedLineStrings.map((f) => turf.getCoords(f));

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

  const timerId = 'Load NPMRDS Target Map Micro Level.';
  console.time(timerId);
  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    const targetMapDao = new TargetMapDAO(xdb, SCHEMA);

    targetMapDao.initializeTargetMapDatabase();

    const edgesIterator = makeEdgesIterator(xdb);

    for (const edge of edgesIterator) {
      const {
        startCoord: [startLon, startLat],
        endCoord: [endLon, endLat],
      } = edge;

      targetMapDao.insertNode({
        lon: startLon,
        lat: startLat,
        properties: null,
      });

      targetMapDao.insertNode({
        lon: endLon,
        lat: endLat,
        properties: null,
      });

      targetMapDao.insertEdge(edge);
    }

    // Cannot do in database using SQL because we need to compute GeoProx keys
    //   The alternative it to iterate over the table while simultaneously mutating it.
    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    console.timeEnd(timerId);
    db.closeLoadingConnectionToDb(xdb);
  }
}
