/* eslint-disable no-restricted-syntax */

import * as turf from '@turf/turf';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function* makeAssignedMatchesIterator(db: SqliteDatabase) {
  try {
    const assignedMatchIter = db
      .prepare(
        `
          SELECT
              shst_reference_id,
              edge_id,
              is_forward,
              section_start,
              section_end
            FROM assigned_matches

            ORDER BY shst_reference_id, section_start ;
        `,
      )
      .iterate();

    // For some unknown reason, the query freezes if this is in a JOIN above.
    const getShstRefStmt = db.prepare(`
      SELECT feature from source_map.shst_reference_features WHERE shst_reference_id = ?
    `);

    for (const {
      shst_reference_id,
      edge_id,
      is_forward,
      section_start,
      section_end,
    } of assignedMatchIter) {
      if (section_start === null) {
        continue;
      }

      const shstRef = JSON.parse(
        getShstRefStmt.pluck().get([shst_reference_id]),
      );

      const assignedMatch = turf.lineSliceAlong(
        shstRef,
        section_start,
        section_end,
      );

      assignedMatch.id = shstRef.id;

      assignedMatch.properties = {
        shst_reference_id,
        edge_id,
        is_forward,
        section_start,
        section_end,
      };

      yield assignedMatch;
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}
