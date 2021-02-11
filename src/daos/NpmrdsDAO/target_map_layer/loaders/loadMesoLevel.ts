/* eslint-disable no-restricted-syntax */

import { strict as assert } from 'assert';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

import nysFipsCodes from '../../constants/nysFipsCodes';

import findMesoLevelPaths from './findMesoLevelPaths';

const MESO_LEVEL_PATH = 'MESO_LEVEL_PATH';

// eslint-disable-next-line import/prefer-default-export
export default async function loadMesoLevelPaths() {
  try {
    const targetMapDao = new TargetMapDAO(SCHEMA);

    targetMapDao.targetMapPathsAreEulerian = true;

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
      // All target map features need to have Paths to get chosen matches.
      // if (features.length < 2) {
      // continue;
      // }

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

    targetMapDao.vacuumDatabase();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
