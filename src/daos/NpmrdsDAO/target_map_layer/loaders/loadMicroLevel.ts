/* eslint-disable no-restricted-syntax */

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import rawEdgeIsUnidirectional from '../utils/rawEdgeIsUnidirectional';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain/types';

// eslint-disable-next-line import/prefer-default-export
export default async function loadMicroLevel() {
  const targetMapDao = new TargetMapDAO<NpmrdsTmcFeature>(SCHEMA);

  targetMapDao.loadMicroLevel(true, rawEdgeIsUnidirectional);
  targetMapDao.targetMapIsCenterline = false;
}
