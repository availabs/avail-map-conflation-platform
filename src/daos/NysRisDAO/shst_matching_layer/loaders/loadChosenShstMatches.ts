/* eslint-disable no-restricted-syntax */

/*
  FIXME: This module isn't testable. Completely destructive on the main database table.
*/

import db from '../../../../services/DbService';
import TargetMapDAO, {
  TargetMapPathMatchesIterator,
  TargetMapPathChosenMatches,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { chooseTargetMapPathShstMatches } from '../../../../services/Conflation';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

export function* makeChoosenTargetMapPathShstMatchesIterator(
  matchesIter: TargetMapPathMatchesIterator,
): Generator<TargetMapPathChosenMatches> {
  for (const { targetMapPathId, targetMapPathMatches } of matchesIter) {
    if (targetMapPathMatches === null || targetMapPathMatches.length === 0) {
      continue;
    }

    const chosen = chooseTargetMapPathShstMatches(targetMapPathMatches);

    const chosenShstMatches =
      chosen?.chosenPaths?.map((chosenPathsForEdge) =>
        chosenPathsForEdge?.map((matchChain) =>
          matchChain?.properties.pathDecompositionInfo.map(({ id }) => id),
        ),
      ) || null;

    const chosenShstMatchesMetadata = chosen?.metadata;

    yield {
      targetMapPathId,
      chosenShstMatches,
      chosenShstMatchesMetadata,
    };
  }
}

export default function loadChosenShstMatches() {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    const targetMapDao = new TargetMapDAO(xdb, SCHEMA);

    targetMapDao.truncatePathChosenMatches();

    const matchesIter = targetMapDao.makeTargetMapPathMatchesIterator();

    const chosenMatchesIter = makeChoosenTargetMapPathShstMatchesIterator(
      matchesIter,
    );

    for (const targetMapPathChosenMatches of chosenMatchesIter) {
      targetMapDao.insertPathChosenMatches(targetMapPathChosenMatches);
    }

    targetMapDao.populateTargetMapEdgeChosenMatches();

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
