/* eslint-disable no-restricted-syntax */

import { writeFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import test from 'tape';

import * as turf from '@turf/turf';

import db from '../../DbService';

import { NYS_RIS as SCHEMA } from '../../../constants/databaseSchemaNames';

import projectRoot from '../../../constants/projectRoot';

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';

const THRESHOLD = 1 - 0.8;

// Initialize the DbService
const outputDir = join(projectRoot, '../output');

db.setOutputDirectory(outputDir);

test('Get chosenShstMatchs.', (t) => {
  const bbDao = new TargetMapConflationBlackboardDao(SCHEMA);

  const targetMapEdgeLengths = [
    ...bbDao.makeTargetMapEdgeFeaturesGeoProximityIterator(),
  ].reduce((acc, targetMapEdge) => {
    const { id } = targetMapEdge;

    acc[id] = turf.length(targetMapEdge);

    return acc;
  }, {});

  const targetMapEdgeIds = Object.keys(targetMapEdgeLengths);

  const shstMatches = [...bbDao.makeAllShstMatchesIterator()];

  writeFileSync(
    join(__dirname, '../../../../shstMatches.geojson'),
    JSON.stringify(turf.featureCollection(shstMatches)),
  );

  const chosenMatches = [...bbDao.makeChosenShstMatchReferencesIterator()];

  const targetMapEdgeChosenMatchesLengths = chosenMatches.reduce(
    (acc, chosenMatch) => {
      const {
        properties: { targetMapEdgeId, isForward, sectionStart, sectionEnd },
      } = chosenMatch;

      const dir = isForward ? 'forward' : 'backward';

      acc[targetMapEdgeId][dir] += sectionEnd - sectionStart;

      return acc;
    },
    targetMapEdgeIds.reduce((acc, edgeId) => {
      acc[edgeId] = { forward: null, backward: null };
      return acc;
    }, {}),
  );

  const forwardFailures = new Set(
    targetMapEdgeIds.filter((targetMapEdgeId) => {
      const edgeLen = targetMapEdgeLengths[targetMapEdgeId];

      const { forward } = targetMapEdgeChosenMatchesLengths[targetMapEdgeId];

      // if (forward === null && backward === null) {
      // return true;
      // }
      if (forward === null) {
        return false;
      }

      const maxLen = Math.max(edgeLen, forward);
      const minLen = Math.min(edgeLen, forward);
      const diffRatio = (maxLen - minLen) / edgeLen;

      return diffRatio > THRESHOLD;
    }),
  );

  const backwardFailures = new Set(
    targetMapEdgeIds.filter((targetMapEdgeId) => {
      const edgeLen = targetMapEdgeLengths[targetMapEdgeId];

      const { backward } = targetMapEdgeChosenMatchesLengths[targetMapEdgeId];

      // if (forward === null && backward === null) {
      // return true;
      // }
      if (backward === null) {
        return false;
      }

      const maxLen = Math.max(edgeLen, backward);
      const minLen = Math.min(edgeLen, backward);
      const diffRatio = (maxLen - minLen) / edgeLen;

      return diffRatio > THRESHOLD;
    }),
  );

  console.log(
    'passing:',
    _.round((1 - forwardFailures.size / targetMapEdgeIds.length) * 100, 5),
    _.round((1 - backwardFailures.size / targetMapEdgeIds.length) * 100, 5),
  );

  writeFileSync(
    join(__dirname, '../../../../chosenMatches.geojson'),
    JSON.stringify(turf.featureCollection(chosenMatches)),
  );

  writeFileSync(
    join(__dirname, '../../../../failChosenMatches.geojson'),
    JSON.stringify(
      turf.featureCollection(
        chosenMatches.filter((m) =>
          forwardFailures.has(`${m.properties.edgeId}`),
        ),
      ),
    ),
  );

  // for (const chosenMatches of bbDao.makeChosenShstMatchReferencesIterator()) {
  // console.log(JSON.stringify(chosenMatches, null, 4));
  // }

  t.end();
});
