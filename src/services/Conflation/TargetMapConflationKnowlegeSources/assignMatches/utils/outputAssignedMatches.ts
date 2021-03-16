/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { createWriteStream } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import { Database as SqliteDatabase } from 'better-sqlite3';
import { AssignedMatch } from '../../../domain/types';

export default async function outputAssignedMatches(
  assignedMatchIter: Generator<AssignedMatch>,
  tmpDb: SqliteDatabase,
) {
  try {
    const writeStream = createWriteStream(
      join(__dirname, '../data/assignedMatches.geojson'),
    );

    // For some unknown reason, the query freezes if this is in a JOIN above.
    const getShstRefStmt = tmpDb.prepare(`
      SELECT feature from source_map.shst_reference_features WHERE shst_reference_id = ?
    `);

    writeStream.write(`{"type":"FeatureCollection","features":[`);

    let i = 0;
    for (const {
      shstReferenceId,
      targetMapEdgeId,
      isForward,
      sectionStart,
      sectionEnd,
    } of assignedMatchIter) {
      if (sectionStart === null) {
        continue;
      }

      const shstRef = JSON.parse(getShstRefStmt.pluck().get([shstReferenceId]));

      const assignedMatch = turf.lineSliceAlong(
        shstRef,
        sectionStart,
        sectionEnd,
      );

      assignedMatch.id = shstRef.id;

      console.log(i, ':', shstRef.id);

      assignedMatch.properties = {
        shstReferenceId,
        targetMapEdgeId,
        isForward,
        sectionStart,
        sectionEnd,
      };

      const good = writeStream.write(
        `${i++ === 0 ? '' : ','}${JSON.stringify(assignedMatch)}`,
      );

      if (!good) {
        await new Promise((resolve) => writeStream.once('drain', resolve));
      }
    }

    writeStream.write(`]}`);
  } catch (err) {
    console.error(err);
    throw err;
  }
}
