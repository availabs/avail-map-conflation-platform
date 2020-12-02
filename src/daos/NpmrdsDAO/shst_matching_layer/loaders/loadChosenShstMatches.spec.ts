/* eslint-disable no-restricted-syntax */

import { join } from 'path';

import test from 'tape';
import * as turf from '@turf/turf';
import _ from 'lodash';

import db from '../../../../services/DbService';

import TargetMapDAO, {
  SharedStreetsMatchFeature,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';
import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import { makeChoosenTargetMapPathShstMatchesIterator } from './loadChosenShstMatches';

const npmrdsDatabasePath = join(__dirname, '../../../../../output/');

db.setOutputDirectory(npmrdsDatabasePath);

const TARGET_MAP_PATHS_SAMPLE_SIZE = 1;
const LOG_TIMES = false;

const getSampleTargetMapPathIds = (targetMapDao: TargetMapDAO) =>
  _.sampleSize(
    [...targetMapDao.makeTargetMapPathIdsIterator()],
    TARGET_MAP_PATHS_SAMPLE_SIZE,
  );

const makeMatchesIter = (targetMapDao: TargetMapDAO) => {
  const pathIds = getSampleTargetMapPathIds(targetMapDao);

  const matchesIter = targetMapDao.makeTargetMapPathMatchesIterator({
    pathIds,
  });

  return matchesIter;
};

test('Dependencies assumptions check', (t) => {
  const errorMessages = [];
  try {
    const targetMapDao = new TargetMapDAO(db, SCHEMA);

    const matchesIter = makeMatchesIter(targetMapDao);

    let hrstart = process.hrtime();
    for (const { targetMapPathId, targetMapPathMatches } of matchesIter) {
      if (targetMapPathMatches !== null) {
        const hrend = process.hrtime(hrstart);

        if (LOG_TIMES) {
          console.log(`%ds %dms`, hrend[0], hrend[1] / 1000000);
        }

        if (!Number.isSafeInteger(targetMapPathId)) {
          errorMessages.push(
            `TargetMapPathId is not an Integer: ${targetMapPathId}`,
          );
        }

        if (
          !(
            Array.isArray(targetMapPathMatches) || targetMapPathMatches === null
          )
        ) {
          errorMessages.push(
            `TargetMapPath ${targetMapPathId} targetMapPathMatches is not an Array or null.`,
          );
        } else {
          targetMapPathMatches.forEach(
            ({ targetMapPathEdge, shstMatches }, targetMapEdgeIdx: number) => {
              const {
                properties: { targetMapId },
              } = targetMapPathEdge;

              if (
                targetMapPathEdge.type !== 'Feature' ||
                _.isEmpty(targetMapPathEdge.properties.targetMapId) ||
                !Array.isArray(targetMapPathEdge.geometry.coordinates)
              ) {
                errorMessages.push(
                  `TargetMapPath ${targetMapPathId}; TargetMapEdge ${targetMapEdgeIdx} is not valid`,
                );
              }

              shstMatches.forEach((shstMatch: SharedStreetsMatchFeature) => {
                if (turf.getType(shstMatch) !== 'LineString') {
                  errorMessages.push(
                    `TargetMapPath ${targetMapPathId}; TargetMapEdge ${targetMapEdgeIdx}; shstMatch is not LineString`,
                  );
                }

                if (shstMatch.properties?.pp_targetmapid !== targetMapId) {
                  errorMessages.push(
                    `TargetMapEdge ${targetMapEdgeIdx}; shstMatch.properties.pp_targetmapid !== targetMapId`,
                  );
                }
              });
            },
          );
        }
      }

      hrstart = process.hrtime();
    }
  } catch (err) {
    t.error(err);
  } finally {
    if (errorMessages.length) {
      errorMessages.forEach((msg) => t.fail(msg));
    } else {
      t.pass('All elements of TargetMapPathMatchesIterator passed tests.');
    }
    t.end();
  }
});

test.only('choosing matches', (t) => {
  const errorMessages = [];
  try {
    const targetMapDao = new TargetMapDAO(db, SCHEMA);

    const matchesIter = makeMatchesIter(targetMapDao);

    const chosenMatchesIter = makeChoosenTargetMapPathShstMatchesIterator(
      matchesIter,
    );

    let hrstart = process.hrtime();
    for (const chosenMatches of chosenMatchesIter) {
      console.log(JSON.stringify(chosenMatches, null, 4));

      const {
        targetMapPathId,
        // chosenShstMatches: { chosenPaths, metadata },
      } = chosenMatches;
      console.log(targetMapPathId);

      if (!Number.isSafeInteger(targetMapPathId)) {
        errorMessages.push(`Invalid targetMapPathId: ${targetMapPathId}`);
      }

      const hrend = process.hrtime(hrstart);

      if (LOG_TIMES) {
        console.log(`%ds %dms`, hrend[0], hrend[1] / 1000000);
      }

      hrstart = process.hrtime();
    }
  } catch (err) {
    t.error(err);
  } finally {
    if (errorMessages.length) {
      errorMessages.forEach((msg) => t.fail(msg));
    } else {
      t.pass(
        `All ${TARGET_MAP_PATHS_SAMPLE_SIZE} paths of ChoosenTargetMapPathShstMatchesIterator passed tests.`,
      );
    }
    t.end();
  }
});
