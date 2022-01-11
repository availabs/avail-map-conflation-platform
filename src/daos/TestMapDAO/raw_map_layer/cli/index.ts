/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import db from '../../../../services/DbService';

import SourceMap from '../../../SourceMapDao';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { TEST_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import { TestMapFeature } from '../domain/types';

const ddl = readFileSync(join(__dirname, './sql/initialize_database.sql'), {
  encoding: 'utf8',
});

const getOsmMeta = ({ osm_way_tags: { way_id, ref, name } }) => ({
  way_id,
  ref: ref || null,
  name: name || null,
});

export default function loadTestMap() {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    xdb.exec(ddl);

    const insrtStmt = xdb.prepare(`
      INSERT INTO test_map.raw_target_map_features (
        target_map_id,
        feature
      ) VALUES (?, json(?)) ;
    `);

    const shstRefIter = SourceMap.makeSharedStreetsReferenceFeaturesIterator();

    let id = 0;

    for (const shstRef of shstRefIter) {
      if (shstRef.properties.roadClass > 7) {
        continue;
      }

      ++id;

      const {
        properties: {
          shstReferenceId,
          roadClass,
          fromIntersectionId,
          toIntersectionId,
          osmMetadataWaySections,
        },
      } = shstRef;

      const osmWayMeta = osmMetadataWaySections.map(
        // @ts-ignore
        getOsmMeta,
      );

      const metaSummary = osmWayMeta.reduce(
        (acc, meta) => {
          const { name, ref } = meta;

          if (name) {
            acc.roadName[name] = ++acc.roadName[name] || 1;
          }

          if (ref) {
            acc.routeNumber[ref] = ++acc.routeNumber[ref] || 1;
          }

          return acc;
        },
        { roadName: {}, routeNumber: {} },
      );

      const roadName = Object.keys(metaSummary.roadName).reduce(
        (acc: string | null, rname) => {
          // @ts-ignore
          if (acc && metaSummary.roadName[acc] > metaSummary.roadName[rname]) {
            return acc;
          }

          return rname;
        },
        null,
      );

      const routeNumber = Object.keys(metaSummary.routeNumber).reduce(
        (acc: string | null, rnum) => {
          // @ts-ignore
          if (metaSummary.routeNumber[acc] > metaSummary.routeNumber[rnum]) {
            return acc;
          }

          return rnum;
        },
        null,
      );

      const pathId = `${routeNumber || roadName || `_id:${id}_`}`
        .toLowerCase()
        .replace(/[^a-z0-9:]+/g, '_');

      const testFeature = {
        ...shstRef,
        properties: {
          shstReferenceId,
          fromIntersectionId,
          toIntersectionId,
          networkLevel: roadClass,
          isPrimary: true,
          roadName,
          routeNumber,
          pathId,
        },
      };

      insrtStmt.run([`${id}`, JSON.stringify(testFeature)]);
    }

    xdb.exec('COMMIT');
  } catch (err) {
    console.error(err);
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }

  const targetMapDao = new TargetMapDAO<TestMapFeature>(SCHEMA);

  targetMapDao.targetMapIsCenterline = false;

  targetMapDao.mapYear = 2022;

  targetMapDao.mapVersion = 'test';
}
