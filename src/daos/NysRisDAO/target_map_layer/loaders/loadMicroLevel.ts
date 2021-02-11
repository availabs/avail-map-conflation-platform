/* eslint-disable no-restricted-syntax */

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import rawEdgeIsUnidirectional from '../utils/rawEdgeIsUnidirectional';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain/types';

// eslint-disable-next-line import/prefer-default-export
export default async function loadMicroLevel() {
  try {
    const timerId = 'Load NYS RIS Target Map Micro Level.';
    console.time(timerId);

    const targetMapDao = new TargetMapDAO<NysRoadInventorySystemFeature>(
      SCHEMA,
    );

    targetMapDao.targetMapIsCenterline = true;

    targetMapDao.loadMicroLevel(true, rawEdgeIsUnidirectional);

    console.timeEnd(timerId);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
