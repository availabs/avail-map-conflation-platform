/* eslint-disable no-restricted-syntax */

import * as turf from '@turf/turf';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function* makeUndisputedChosenMatchesIterator(
  db: SqliteDatabase,
) {
  const iter = db
    .prepare(
      `
        SELECT
            b.path_id,
            b.path_edge_idx,
            b.edge_id,
            b.is_forward,
            b.edge_shst_match_idx,
            b.section_start,
            b.section_end,
            a.feature
          FROM source_map.shst_reference_features AS a
            INNER JOIN target_map_bb.target_map_edge_chosen_matches AS b
              ON (a.shst_reference_id = b.shst_reference)
            LEFT OUTER JOIN chosen_match_initial_disputes_claimants AS c
              USING (
                path_id,
                path_edge_idx,
                is_forward,
                edge_shst_match_idx
              )
          WHERE ( c.dispute_id IS NULL )
      `,
    )
    .iterate();

  for (const {
    path_id,
    path_edge_idx,
    edge_id,
    is_forward,
    edge_shst_match_idx,
    section_start,
    section_end,
    feature,
  } of iter) {
    const shstRef = JSON.parse(feature);

    const chosenMatch = turf.lineSliceAlong(
      shstRef,
      section_start,
      section_end,
    );

    chosenMatch.id = shstRef.id;
    chosenMatch.properties = {
      shst_reference_id: shstRef.id,
      road_class: shstRef.properties.minOsmRoadClass,
      path_id,
      path_edge_idx,
      edge_id,
      is_forward,
      edge_shst_match_idx,
      section_start,
      section_end,
    };

    yield chosenMatch;
  }
}
