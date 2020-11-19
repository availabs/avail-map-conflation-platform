/* eslint-disable no-restricted-syntax */

import { strict as assert } from 'assert';
import _ from 'lodash';

import db from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

import nysFipsCodes from '../../constants/nysFipsCodes';

import findMesoLevelPaths from './findMesoLevelPaths';

const MESO_LEVEL_PATH = 'MESO_LEVEL_PATH';

// eslint-disable-next-line import/prefer-default-export
export default async function loadMesoLevelPaths() {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    const targetMapDao = new TargetMapDAO(xdb, SCHEMA);

    targetMapDao.deleteAllPathsWithLabel(MESO_LEVEL_PATH);

    const edgesByLinearTmcIterator = targetMapDao.makeGroupedRawEdgeFeaturesIterator(
      {
        groupByRawProperties: ['lineartmc', 'county'],
      },
    );

    // @ts-ignore
    for (const {
      lineartmc,
      county,
      features,
    }: {
      features: NpmrdsTmcFeature[];
    } of edgesByLinearTmcIterator) {
      const tmcs = features.map((f) => _.get(f, ['properties', 'tmc']));

      console.log(JSON.stringify({ tmcs }, null, 4));

      if (features.length < 2) {
        continue;
      }

      const countyName = county.replace(/ /g, '_').toLowerCase();
      const fipsCode = nysFipsCodes[countyName];

      assert(fipsCode !== undefined);

      // @ts-ignore
      const tmcPaths = findMesoLevelPaths(features);

      for (let i = 0; i < tmcPaths.length; ++i) {
        const tmcsSequence = tmcPaths[i];

        const edgeIdSequence = targetMapDao.transformTargetMapIdSequenceToEdgeIdSequence(
          tmcsSequence,
        );

        const targetMapMesoId = `${lineartmc}:${fipsCode}:${i}`;

        // TODO: Properties should include bearing.
        const properties = {
          targetMapMesoId,
        };

        const pathId = targetMapDao.insertPath({ properties, edgeIdSequence });

        if (pathId !== null) {
          targetMapDao.insertPathLabel({
            pathId,
            label: 'MESO_LEVEL_PATH',
          });
        }
      }
    }

    xdb.exec('COMMIT');

    targetMapDao.vacuumDatabase();
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
