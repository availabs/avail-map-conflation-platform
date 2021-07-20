/* eslint-disable no-restricted-syntax */
import * as turf from '@turf/turf';

import DbService from '../../../../services/DbService';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO, {
  TargetMapPropertiesFromRawEdgeFn,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain/types';

export function rawEdgeIsUnidirectional(
  feature: NysRoadInventorySystemFeature,
) {
  const {
    properties: { oneway, divided, total_lanes, primary_dir_lanes },
  } = feature;

  return (
    oneway === 'Y' || (divided === 'Y' && total_lanes === primary_dir_lanes)
  );
}

// @ts-ignore
const getTargetMapPropertiesFromRawEdge: TargetMapPropertiesFromRawEdgeFn = (
  feature: NysRoadInventorySystemFeature,
) => {
  const {
    properties: {
      road_name: roadName,
      route_no: routeNumber,
      functional_class,
      overlap_hierarchy,
    },
  } = feature;

  const targetMapId = feature.id;
  const targetMapEdgeLength = turf.length(feature);
  const isUnidirectional = rawEdgeIsUnidirectional(feature);
  const networkLevel = functional_class % 10;

  // @ts-ignore
  const isPrimary = overlap_hierarchy < 1;

  return {
    targetMapId,
    targetMapEdgeLength,
    isUnidirectional,
    roadName,
    routeNumber,
    networkLevel,
    isPrimary,
  };
};

// eslint-disable-next-line import/prefer-default-export
export default async function loadMicroLevel() {
  const db = DbService.openConnectionToDb(SCHEMA);

  const targetMapDao = new TargetMapDAO<NysRoadInventorySystemFeature>(SCHEMA);

  try {
    db.pragma(`${SCHEMA}.journal_mode = WAL`);

    const timerId = 'Load NYS RIS Target Map Micro Level.';
    console.time(timerId);

    targetMapDao.loadMicroLevel(true, getTargetMapPropertiesFromRawEdge);

    console.timeEnd(timerId);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    targetMapDao.closeConnections();

    db.pragma(`${SCHEMA}.journal_mode = DELETE`);
  }
}
