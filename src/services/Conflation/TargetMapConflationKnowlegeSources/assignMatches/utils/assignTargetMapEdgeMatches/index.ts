/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function assignTargetMapEdgeMatches(tmpDb: SqliteDatabase) {
  tmpDb.exec(
    readFileSync(
      join(__dirname, '../../sql/create_assigned_matches_table.sql'),
      {
        encoding: 'utf8',
      },
    ),
  );

  tmpDb.exec(`
    INSERT OR IGNORE INTO tmp_assigned_matches
      SELECT
          shst_reference_id,

          edge_id AS target_map_edge_id,

          is_forward,

          NULL AS section_start,
          NULL AS section_end
        FROM tmp_chosen_match_disputed_sections AS a
          INNER JOIN tmp_chosen_match_dispute_claimants
            USING (dispute_id) ;
  `);

  tmpDb.exec(`
    INSERT OR IGNORE INTO tmp_assigned_matches
      SELECT
          shst_reference AS shst_reference_id,

          edge_id AS target_map_edge_id,

          is_forward,

          section_start,
          section_end
        FROM target_map_bb.target_map_edge_chosen_shst_matches
        ORDER BY
          shst_reference,
          edge_id,
          (section_end - section_start) DESC ;
  `);
}
