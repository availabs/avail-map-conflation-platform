/* eslint-disable no-restricted-syntax */
import * as turf from '@turf/turf';

import DbService from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO, {
  TargetMapPropertiesFromRawEdgeFn,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import rawEdgeIsUnidirectional from '../utils/rawEdgeIsUnidirectional';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain/types';

// @ts-ignore
const getTargetMapPropertiesFromRawEdge: TargetMapPropertiesFromRawEdgeFn = (
  feature: NpmrdsTmcFeature,
) => {
  const {
    properties: {
      road: roadName,
      route_numb: routeNumber,
      f_system: networkLevel,
      isprimary: isPrimary,
    },
  } = feature;

  const targetMapId = feature.id;
  const targetMapEdgeLength = turf.length(feature);
  const isUnidirectional = rawEdgeIsUnidirectional(feature);

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

  const targetMapDao = new TargetMapDAO<NpmrdsTmcFeature>(SCHEMA);

  try {
    db.pragma(`${SCHEMA}.journal_mode = WAL`);

    targetMapDao.loadMicroLevel(true, getTargetMapPropertiesFromRawEdge);
  } finally {
    targetMapDao.closeConnections();
    db.pragma(`${SCHEMA}.journal_mode = DELETE`);
  }
}
