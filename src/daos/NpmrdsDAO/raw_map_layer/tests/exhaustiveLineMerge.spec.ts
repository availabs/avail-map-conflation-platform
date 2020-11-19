/* eslint-disable no-restricted-syntax */
import { join } from 'path';

import test from 'tape';

import * as turf from '@turf/turf';
import _ from 'lodash';

import Database from 'better-sqlite3';

import lineMerge from '../../../../utils/gis/lineMerge';

const testDB = Database(
  join(__dirname, '../../../../../output/sqlite/npmrds.bak'),
);

const VERBOSE = true;
const LENGTH_TOLERANCE = 0.015;

test('LineMerge MultiLineStrings', (t) => {
  const iter = testDB
    .prepare(
      `
        SELECT
            feature
          FROM raw_target_map_features
          WHERE ( json_extract(feature, '$.geometry.type') = 'MultiLineString' )
        ; `,
    )
    .raw()
    .iterate();

  try {
    for (const featureStr of iter) {
      const errorMessages = [];

      const feature = JSON.parse(featureStr);
      const { tmc } = feature.properties;
      feature.properties = { tmc };

      const lineStrings = lineMerge(feature);

      const origLength = turf.length(feature);
      const mergedLength = _.sum(lineStrings.map((f) => turf.length(f)));

      const lenDiffRatio = Math.abs(origLength - mergedLength) / origLength;

      if (lenDiffRatio > LENGTH_TOLERANCE) {
        errorMessages.push(`lenDiffRatio = ${lenDiffRatio}`);
      }

      if (_.isEmpty(errorMessages)) {
        t.pass(`${tmc} passed line merge`);
      } else {
        t.fail(`${tmc} failed line merge\n${errorMessages.join('\t\n')}`);

        if (VERBOSE) {
          console.log('Original MultiLineString:');
          console.log(JSON.stringify(feature));
          console.log('Merged MultiLineString:');
          lineStrings.forEach((f) => console.log(JSON.stringify(f)));
        }
      }
    }
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});

test('LineMerge Linestrings', (t) => {
  const iter = testDB
    .prepare(
      `
        SELECT
            feature
          FROM raw_target_map_features
          WHERE ( json_extract(feature, '$.geometry.type') = 'LineString' )
        ; `,
    )
    .raw()
    .iterate();

  try {
    for (const featureStr of iter) {
      const errorMessages = [];
      const feature = JSON.parse(featureStr);
      const { tmc } = feature.properties;
      feature.properties = { tmc };

      const lineStrings = lineMerge(feature);

      if (lineStrings.length !== 1) {
        errorMessages.push('LineString merged yields multiple linestrings');
      }

      const [lineString] = lineStrings;

      const origCoords = turf.getCoords(feature).reduce((acc, pos) => {
        if (!_.isEqual(pos, acc[acc.length - 1])) {
          acc.push(pos);
        }

        return acc;
      }, []);

      const mergedCoords = turf.getCoords(lineString);

      if (!_.isEqual(mergedCoords, origCoords)) {
        errorMessages.push('Merged Coords ≠ Original Coords');
      }

      if (_.isEmpty(errorMessages)) {
        t.pass(`${tmc} passed line merge`);
      } else {
        t.fail(`${tmc} failed line merge`);
        errorMessages.forEach((msg) => t.fail(msg));

        if (VERBOSE) {
          console.log('Original MultiLineString:');
          console.log(JSON.stringify(feature));
          console.log('Merged MultiLineString:');
          lineStrings.forEach((f) => console.log(JSON.stringify(f)));
        }
      }
    }
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});

/*
test('LineMerge Specific TMC', (t) => {
  const iter = testDB
    .prepare(
      `
        SELECT
            feature
          FROM raw_target_map_features
          WHERE ( target_map_id = '104P09673' )
        ; `,
    )
    .raw()
    .iterate();

  try {
    for (const featureStr of iter) {
      const errorMessages = [];
      const feature = JSON.parse(featureStr);
      const { tmc } = feature.properties;

      const lineStrings = lineMerge(feature);

      if (lineStrings.length !== 1) {
        errorMessages.push('LineString merged yields multiple linestrings');
      }

      const origLength = turf.length(feature);
      const mergedLength = _.sum(lineStrings.map((f) => turf.length(f)));

      const lenDiffRatio = Math.abs(origLength - mergedLength) / origLength;

      if (lenDiffRatio > LENGTH_TOLERANCE) {
        errorMessages.push(`lenDiffRatio = ${lenDiffRatio}`);
      }

      if (_.isEmpty(errorMessages)) {
        t.pass(`${tmc} passed line merge`);
      } else {
        t.fail(`${tmc} failed line merge\n${errorMessages.join('\t\n')}`);

        if (VERBOSE) {
          console.log('Original MultiLineString:');
          console.log(JSON.stringify(feature));
          console.log('Merged MultiLineString:');
          lineStrings.forEach((f) => console.log(JSON.stringify(f)));
        }
      }
    }
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});
*/
