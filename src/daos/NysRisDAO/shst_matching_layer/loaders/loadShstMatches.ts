/* eslint-disable no-restricted-syntax */

import db from '../../../../services/DbService';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { makeMatchedTargetMapEdgesIterator } from '../../../../services/Conflation';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

export default async function loadShstMatches() {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    const targetMapDao = new TargetMapDAO(xdb, SCHEMA);

    targetMapDao.truncateMatchesTables();

    const iter = targetMapDao.makeTargetMapEdgeFeaturesIterator();
    const matchesIter = makeMatchedTargetMapEdgesIterator(iter, {
      centerline: true,
    });

    for await (const { matchFeature } of matchesIter) {
      targetMapDao.insertShstMatch(matchFeature);
    }

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
