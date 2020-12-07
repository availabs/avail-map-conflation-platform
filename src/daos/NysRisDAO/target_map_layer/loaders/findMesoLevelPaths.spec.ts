/* eslint-disable no-restricted-syntax */

import { join } from 'path';

import test from 'tape';
import * as turf from '@turf/turf';
import _ from 'lodash';

import db from '../../../../services/DbService';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain/types';

import findMesoLevelPaths from './findMesoLevelPaths';

const npmrdsDatabasePath = join(__dirname, '../../../../../output/');

db.setOutputDirectory(npmrdsDatabasePath);

test('Dependencies assumptions check: NYS RIS contiguous across (gis_id, county_name)', (t) => {
  /*
    NOTE: Mile marker posts are not contiguous.
        ✖ Not contiguous: 100077011 ALBANY 6.1-8.41
        ✖ Not contiguous: 100081021 ALBANY 13.47-14.17
        ✖ Not contiguous: 100290041 ALBANY 20.94-21.27
        ✖ Not contiguous: 100290041 ALBANY 24.14-24.22
        ✖ Not contiguous: 100405021 ALBANY 10.26-12.26
        ✖ Not contiguous: 100468081 ALBANY 3.54-3.74
        ✖ Not contiguous: 100515141 ALBANY 6.55-6.85
        ✖ Not contiguous: 100911011 ALBANY 1.59-3.24
        ✖ Not contiguous: 104078011 ALBANY 0.91-1.07
        ✖ Not contiguous: 105033011 ALBANY 0.64-1.14
        ✖ Not contiguous: 312140011 ALBANY 0.68-0.73
        ✖ Not contiguous: 312215011 ALBANY 0.02-0.06
  */

  try {
    const errorMessages: string[] = [];

    const iter = db
      .prepare(
        `
          SELECT
              json_extract(feature, '$.properties.gis_id') AS gis_id,
              json_extract(feature, '$.properties.county_name') AS county_name,
              json_group_array(
                json(feature)
              ) AS features
            FROM ${SCHEMA}.raw_target_map_features
            WHERE ( feature IS NOT NULL )
            GROUP BY 1,2
        `,
      )
      .raw()
      .iterate();

    for (const [gis_id, county_name, featuresStr] of iter) {
      const features: NysRoadInventorySystemFeature[] = _(
        JSON.parse(featuresStr),
      )
        .sortBy('properties.beg_mp')
        .value();

      if (
        !features
          .slice(1)
          .every((f, i) => features[i].properties.end_mp <= f.properties.beg_mp)
      ) {
        console.error('Feature sorting broken.');
        process.exit(1);
      }

      for (let i = 1; i < features.length; ++i) {
        const prev = features[i - 1];
        const cur = features[i];

        const preEndMp = prev.properties.end_mp;
        const curBegMp = cur.properties.beg_mp;

        const prevSegEndCoords = _(turf.getCoords(prev))
          .flattenDeep()
          .chunk(2)
          .last();

        const curSegStartCoords = _(turf.getCoords(cur))
          .flattenDeep()
          .chunk(2)
          .first();

        if (
          preEndMp === curBegMp &&
          !_.isEqual(prevSegEndCoords, curSegStartCoords)
        ) {
          errorMessages.push(
            `Not contiguous: ${gis_id} ${county_name} ${preEndMp}-${curBegMp}`,
          );
          console.error('-'.repeat(30));
          console.error(JSON.stringify({ prev, cur }, null, 4));
          console.error('-'.repeat(30));
        }
      }
    }

    if (errorMessages.length) {
      errorMessages.forEach((msg) => t.fail(msg));
    } else {
      t.pass('All invariant checks pass');
    }
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});

test('Exhaustive findMesoLevelPaths invariant test', (t) => {
  try {
    const errorMessages: string[] = [];

    const iter = db
      .prepare(
        `
          SELECT
              json_extract(feature, '$.properties.gis_id') AS gis_id,
              json_extract(feature, '$.properties.county_name') AS county_name,
              json_group_array(
                json(feature)
              ) AS features
            FROM ${SCHEMA}.raw_target_map_features
            WHERE ( feature IS NOT NULL )
            GROUP BY 1,2
        `,
      )
      .raw()
      .iterate();

    for (const [gis_id, county_name, featuresStr] of iter) {
      const features = JSON.parse(featuresStr);
      const numFeatures = features.length;

      const featuresById: Record<
        number,
        NysRoadInventorySystemFeature
      > = _.keyBy(features, 'id');

      const paths = findMesoLevelPaths(features);

      const totalPathEdges = _.flattenDeep(paths).length;

      if (numFeatures !== totalPathEdges) {
        errorMessages.push(
          `Incomplete paths. ${JSON.stringify(
            { numFeatures, totalPathEdges },
            null,
            4,
          )}`,
        );
      }

      paths.forEach((path, pathIdx) =>
        path.slice(1).forEach((curId, pathEdgeIdx) => {
          const prevId = path[pathEdgeIdx];

          const prev = featuresById[prevId];
          const cur = featuresById[curId];

          const prevSegEndCoords = _(turf.getCoords(prev))
            .flattenDeep()
            .chunk(2)
            .last();

          const curSegStartCoords = _(turf.getCoords(cur))
            .flattenDeep()
            .chunk(2)
            .first();

          if (!_.isEqual(prevSegEndCoords, curSegStartCoords)) {
            errorMessages.push(
              `Non-contiguous path. ${JSON.stringify(
                { gis_id, county_name, pathIdx, pathEdgeIdx },
                null,
                4,
              )}`,
            );
          }
        }),
      );
    }

    if (errorMessages.length) {
      errorMessages.forEach((msg) => t.fail(msg));
    } else {
      t.pass('All invariant checks pass');
    }
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});
