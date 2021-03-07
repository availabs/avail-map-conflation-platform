/* eslint-disable no-restricted-syntax */

import { strict as assert } from 'assert';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO, {
  PreloadedTargetMapPath,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

import nysFipsCodes from '../../constants/nysFipsCodes';

import findMesoLevelPaths from './findMesoLevelPaths';

type NpmrdsTargetMapDao = TargetMapDAO<NpmrdsTmcFeature>;

function* makePreloadedTargetMapEdgesIterator(
  targetMapDao: NpmrdsTargetMapDao,
): Generator<PreloadedTargetMapPath> {
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

      yield { properties, edgeIdSequence };
    }
  }
}

// eslint-disable-next-line import/prefer-default-export
export default async function loadMesoLevelPaths() {
  try {
    const targetMapDao = new TargetMapDAO<NpmrdsTmcFeature>(SCHEMA);

    targetMapDao.targetMapPathsAreEulerian = true;

    const preloadedTargetMapEdgesIterator = makePreloadedTargetMapEdgesIterator(
      targetMapDao,
    );

    targetMapDao.bulkLoadPaths(
      preloadedTargetMapEdgesIterator,
      'MESO_LEVEL',
      true,
    );

    targetMapDao.vacuumDatabase();
  } catch (err) {
    console.error();
    process.exit(1);
  }
}
