/* eslint-disable no-restricted-syntax */

import DbService from '../../../../services/DbService';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import rawEdgeIsUnidirectional from '../utils/rawEdgeIsUnidirectional';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain/types';

// eslint-disable-next-line import/prefer-default-export
export default async function loadMicroLevel() {
  const db = DbService.openConnectionToDb(SCHEMA);

  const targetMapDao = new TargetMapDAO<NysRoadInventorySystemFeature>(SCHEMA);

  try {
    db.pragma(`${SCHEMA}.journal_mode = WAL`);

    const timerId = 'Load NYS RIS Target Map Micro Level.';
    console.time(timerId);

    targetMapDao.loadMicroLevel(true, rawEdgeIsUnidirectional);

    console.timeEnd(timerId);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    targetMapDao.closeConnections();

    db.pragma(`${SCHEMA}.journal_mode = DELETE`);
  }
}
