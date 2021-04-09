/* eslint-disable no-restricted-syntax */

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function* makeUnmatchedTargetMapEdgesIterator(
  db: SqliteDatabase,
) {
  const iter = db
    .prepare(
      `
        SELECT
            a.feature
          FROM target_map.target_map_ppg_edge_line_features AS a
            LEFT OUTER JOIN target_map_bb.target_map_edge_chosen_matches AS b
              USING (edge_id)
          WHERE ( b.shst_reference IS NULL ) ;
      `,
    )
    .iterate();

  for (const { feature } of iter) {
    try {
      const targetMapEdge = JSON.parse(feature);

      targetMapEdge.properties = {
        edge_id: targetMapEdge.id,
      };

      yield targetMapEdge;
    } catch (err) {
      //
    }
  }
}
