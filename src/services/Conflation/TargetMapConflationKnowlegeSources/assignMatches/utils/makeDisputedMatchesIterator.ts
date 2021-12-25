/* eslint-disable no-restricted-syntax */

import * as turf from '@turf/turf';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function* makeDisputedMatchesIterator(db: SqliteDatabase) {
  const iter = db
    .prepare(
      `
        SELECT
            b.dispute_id,
            b.disputed_section_start,
            b.disputed_section_end,
            b.shst_reference_id,
            c.path_id,
            c.path_edge_idx,
            c.edge_id,
            c.is_forward,
            c.edge_shst_match_idx,
            a.feature
          FROM source_map.shst_reference_features AS a
            INNER JOIN chosen_match_unresolved_disputes_sections AS b
              USING (shst_reference_id)
            INNER JOIN chosen_match_unresolved_disputes_claimants AS c
              USING (dispute_id)
      `,
    )
    .iterate();

  for (const {
    dispute_id,
    disputed_section_start,
    disputed_section_end,
    shst_reference_id,
    path_id,
    path_edge_idx,
    edge_id,
    is_forward,
    edge_shst_match_idx,
    feature,
  } of iter) {
    try {
      const shstRef = JSON.parse(feature);
      const disputedSection = turf.lineSliceAlong(
        shstRef,
        disputed_section_start,
        disputed_section_end,
      );

      disputedSection.id = shst_reference_id;
      disputedSection.properties = {
        dispute_id,
        disputed_section_start,
        disputed_section_end,
        shst_reference_id,
        path_id,
        path_edge_idx,
        edge_id,
        is_forward,
        edge_shst_match_idx,
      };

      yield disputedSection;
    } catch (err) {
      //
    }
  }
}
