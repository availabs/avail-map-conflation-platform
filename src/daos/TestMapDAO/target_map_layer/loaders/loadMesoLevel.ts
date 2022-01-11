/* eslint-disable no-restricted-syntax */

import DbService from '../../../../services/DbService';

import { TEST_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO, {
  PreloadedTargetMapPath,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { TestMapFeature } from '../../raw_map_layer/domain/types';

import getBearing from '../../../../utils/gis/getBearing';

import findMesoLevelPaths from './findMesoLevelPaths';

type TestTargetMapDAO = TargetMapDAO<TestMapFeature>;

function* makePreloadedTargetMapEdgesIterator(
  targetMapDao: TestTargetMapDAO,
): Generator<PreloadedTargetMapPath> {
  const edgesByLinearTmcIterator = targetMapDao.makeGroupedRawEdgeFeaturesIterator(
    {
      groupByRawProperties: ['pathId'],
    },
  );

  console.log('LOAD MESO_LEVEL');

  // @ts-ignore
  for (const {
    pathId,
    features,
  }: {
    features: TestMapFeature[];
  } of edgesByLinearTmcIterator) {
    console.log(pathId, features.length);

    const featuresById = features.reduce((acc, feature) => {
      acc[feature.id] = feature;
      return acc;
    }, {});

    // @ts-ignore
    const idPaths = findMesoLevelPaths(features);

    for (let i = 0; i < idPaths.length; ++i) {
      const idsSequence = idPaths[i];

      const edgeIdSequence = targetMapDao.transformTargetMapIdSequenceToEdgeIdSequence(
        idsSequence,
      );

      const targetMapPath = idsSequence.map((id) => featuresById[id]);

      const targetMapPathBearing = getBearing(targetMapPath);

      const targetMapMesoId = `${pathId}:${i}`;

      // TODO: Properties should include bearing.
      const properties = {
        targetMapMesoId,
        targetMapPathBearing,
      };

      yield { properties, edgeIdSequence };
    }
  }
}

// eslint-disable-next-line import/prefer-default-export
export default async function loadMesoLevelPaths() {
  const db = DbService.openConnectionToDb(SCHEMA);

  const targetMapDao = new TargetMapDAO<TestMapFeature>(SCHEMA);

  try {
    db.pragma(`${SCHEMA}.journal_mode = WAL`);

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
    throw err;
  } finally {
    targetMapDao.closeConnections();
    db.pragma(`${SCHEMA}.journal_mode = DELETE`);
  }
}
