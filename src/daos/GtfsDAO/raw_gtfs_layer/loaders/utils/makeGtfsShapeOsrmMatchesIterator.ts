/* eslint-disable no-restricted-syntax, no-await-in-loop, no-param-reassign */

import * as turf from '@turf/turf';
import booleanContains from '@turf/boolean-contains';

import _ from 'lodash';

import { Database as SqliteDatabase } from 'better-sqlite3';

import SourceMapDao from '../../../../SourceMapDao';
import { SharedStreetsReferenceId } from '../../../../SourceMapDao/domain/types';

import { getOsmMatchNodes } from '../../../../../services/Osrm';

import GeoPackageWriter from '../../../../../services/Conflation/developmentTools/conflationSpatial/utils/GeoPackageWriter';

export default async function* makeGtfsShapeOsrmMatchesIterator(
  db: SqliteDatabase,
  matchedShstRefsWriter: GeoPackageWriter | undefined | null,
): AsyncGenerator<{
  shapeId: string;
  shstRefIds: SharedStreetsReferenceId[] | null;
}> {
  const agencyName = db
    .prepare('SELECT agency_name FROM gtfs.agency;')
    .pluck()
    .get();

  const numShapes = db
    .prepare('SELECT COUNT(DISTINCT shape_id) FROM gtfs.shapes;')
    .pluck()
    .get();

  const iter = db
    .prepare(
      `
        SELECT
            feature
          FROM gtfs.shape_linestrings
      `,
    )
    .raw()
    .iterate();

  let i = 0;
  for (const [shapeFeatureStr] of iter) {
    console.log(`${agencyName} shape: ${++i} / ${numShapes}`);

    const label = '     full shape load';
    console.time(label);

    const shape = JSON.parse(shapeFeatureStr);

    console.log('     shape length:', turf.length(shape));

    const shapeId = shape.id;

    const seenShstRefIds = new Set();

    try {
      const osmNodes = await getOsmMatchNodes(shape);

      const shapeBuffer = turf.buffer(shape, 0.05);

      if (osmNodes?.length) {
        const sublabel = `     SourceMapDao`;
        console.time(sublabel);
        const matchedShstRefs = _.flattenDeep(
          osmNodes?.map(({ legNodes }) =>
            SourceMapDao.getShstReferencesForOsmNodeSequences(
              _.flattenDeep(legNodes),
            )?.filter(
              (shstRef) => shstRef && booleanContains(shapeBuffer, shstRef),
            ),
          ),
        ).filter(Boolean);

        if (matchedShstRefsWriter) {
          matchedShstRefs.forEach((shstRef) => {
            if (!seenShstRefIds.has(shstRef?.id)) {
              // @ts-ignore
              matchedShstRefsWriter.write(shstRef);
              seenShstRefIds.add(shstRef?.id);
            }
          });
        }

        // @ts-ignore
        const shstRefIds = matchedShstRefs.map(({ id }) => id);

        console.timeEnd(sublabel);

        console.time('     yield');
        yield {
          shapeId,
          shstRefIds: shstRefIds.length ? _.uniq(shstRefIds) : null,
        };
        console.timeEnd('     yield');
      } else {
        yield {
          shapeId,
          shstRefIds: null,
        };
      }
    } catch (err) {
      console.error(err);
    } finally {
      console.timeEnd(label);
    }
  }
}
