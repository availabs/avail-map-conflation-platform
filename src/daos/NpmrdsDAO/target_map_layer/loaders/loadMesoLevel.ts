/* eslint-disable no-restricted-syntax */

import DbService from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO, {
  PreloadedTargetMapPath,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

import getBearing from '../../../../utils/gis/getBearing';

import findMesoLevelPaths from './findMesoLevelPaths';

type NpmrdsTargetMapDao = TargetMapDAO<NpmrdsTmcFeature>;

function* makePreloadedTargetMapEdgesIterator(
  targetMapDao: NpmrdsTargetMapDao,
): Generator<PreloadedTargetMapPath> {
  const edgesByLinearTmcIterator = targetMapDao.makeGroupedRawEdgeFeaturesIterator(
    {
      groupByRawProperties: ['_route_id_'],
    },
  );

  // @ts-ignore
  for (const {
    _route_id_,
    features,
  }: {
    features: NpmrdsTmcFeature[];
  } of edgesByLinearTmcIterator) {
    const cleanedPathId = _route_id_.toLowerCase().replace(/[^a-z0-9:]+/g, '_');

    const featuresById = features.reduce((acc, feature) => {
      acc[feature.id] = feature;
      return acc;
    }, {});

    // @ts-ignore
    const tmcPaths = findMesoLevelPaths(features);

    for (let i = 0; i < tmcPaths.length; ++i) {
      const tmcsSequence = tmcPaths[i];

      const edgeIdSequence = targetMapDao.transformTargetMapIdSequenceToEdgeIdSequence(
        tmcsSequence,
      );

      const targetMapPath = tmcsSequence.map((id) => featuresById[id]);

      const targetMapPathBearing = getBearing(targetMapPath);

      const targetMapMesoId = `${cleanedPathId}:${i}`;

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

  const targetMapDao = new TargetMapDAO<NpmrdsTmcFeature>(SCHEMA);

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
