/* eslint-disable no-restricted-syntax */

import db from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

// eslint-disable-next-line import/prefer-default-export
export default async function loadMicroLevel() {
  const timerId = 'Load NPMRDS Target Map Micro Level.';
  console.time(timerId);

  const targetMapDao = new TargetMapDAO(db, SCHEMA);

  targetMapDao.loadMicroLevel();
  targetMapDao.targetMapIsCenterline = false;

  console.timeEnd(timerId);
}
