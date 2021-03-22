/* eslint-disable no-restricted-syntax */

import { strict as assert } from 'assert';

import _ from 'lodash';

import DbService from '../../../../services/DbService';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO, {
  PreloadedTargetMapPath,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain';

import getBearing from '../../../../utils/gis/getBearing';

import nysFipsCodes from '../../../../constants/nysFipsCodes';

import findMesoLevelPaths from './findMesoLevelPaths';

type NysRisTargetMapDao = TargetMapDAO<NysRoadInventorySystemFeature>;

function* makePreloadedTargetMapEdgesIterator(
  targetMapDao: NysRisTargetMapDao,
): Generator<PreloadedTargetMapPath> {
  console.time('edgeIter');
  const edgesByLinearTmcIterator = targetMapDao.makeGroupedRawEdgeFeaturesIterator(
    {
      groupByRawProperties: ['gis_id', 'county_name'],
    },
  );

  let timer = true;
  // @ts-ignore
  for (const {
    gis_id,
    county_name,
    features,
  }: {
    features: NysRoadInventorySystemFeature[];
  } of edgesByLinearTmcIterator) {
    if (timer) {
      console.timeEnd('edgeIter');
      timer = false;
    }

    const featuresById = features.reduce((acc, feature) => {
      acc[feature.id] = feature;
      return acc;
    }, {});

    // All target map features need to have Paths to get chosen matches.
    // if (features.length < 2) {
    // continue;
    // }

    const countyName = county_name.replace(/ /g, '_').toLowerCase();
    const fipsCode = nysFipsCodes[countyName];

    assert(fipsCode !== undefined);

    // @ts-ignore
    // TODO: Is it guaranteed that the sequential segments connect end to end?
    //       Do there exist cases where directions reverse within same gis_ids?
    const paths = findMesoLevelPaths(features);

    for (let i = 0; i < paths.length; ++i) {
      const targetMapIdsSequence = paths[i];

      const edgeIdSequence = targetMapDao.transformTargetMapIdSequenceToEdgeIdSequence(
        targetMapIdsSequence,
      );

      const targetMapPath = targetMapIdsSequence.map((id) => featuresById[id]);

      const targetMapPathBearing = getBearing(targetMapPath);

      const targetMapMesoId = `${gis_id}:${fipsCode}:${i}`;

      // TODO: Properties should include bearing.
      const properties = {
        targetMapMesoId,
        targetMapPathBearing:
          targetMapPathBearing && _.round(targetMapPathBearing, 5),
      };

      yield { properties, edgeIdSequence };
    }
  }
}

// eslint-disable-next-line import/prefer-default-export
export default async function loadMesoLevelPaths() {
  const db = DbService.openConnectionToDb(SCHEMA);

  const targetMapDao = new TargetMapDAO<NysRoadInventorySystemFeature>(SCHEMA);

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
