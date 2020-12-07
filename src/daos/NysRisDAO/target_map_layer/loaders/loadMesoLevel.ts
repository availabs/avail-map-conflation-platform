/* eslint-disable no-restricted-syntax */

import { strict as assert } from 'assert';

import db from '../../../../services/DbService';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain';

import nysFipsCodes from '../../../../constants/nysFipsCodes';

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
        groupByRawProperties: ['gis_id', 'county_name'],
      },
    );

    // @ts-ignore
    for (const {
      gis_id,
      county_name,
      features,
    }: {
      features: NysRoadInventorySystemFeature[];
    } of edgesByLinearTmcIterator) {
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

        const targetMapMesoId = `${gis_id}:${fipsCode}:${i}`;

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
