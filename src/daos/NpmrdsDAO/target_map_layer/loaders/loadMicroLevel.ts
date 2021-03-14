/* eslint-disable no-restricted-syntax */

import DbService from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import rawEdgeIsUnidirectional from '../utils/rawEdgeIsUnidirectional';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain/types';

// eslint-disable-next-line import/prefer-default-export
export default async function loadMicroLevel() {
  const db = DbService.openConnectionToDb(SCHEMA);

  const targetMapDao = new TargetMapDAO<NpmrdsTmcFeature>(SCHEMA);

  try {
    db.pragma(`${SCHEMA}.journal_mode = WAL`);

    targetMapDao.loadMicroLevel(true, rawEdgeIsUnidirectional);
  } finally {
    targetMapDao.closeConnections();
    db.pragma(`${SCHEMA}.journal_mode = DELETE`);
  }
}
