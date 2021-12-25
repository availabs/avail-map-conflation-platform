/* eslint-disable no-restricted-syntax */

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function* makeDisputesIterator(db: SqliteDatabase) {
  const iter = db
    .prepare(
      `
        SELECT
            dispute_id,

            disputed_section_start,
            disputed_section_end,

            d.feature AS shst_ref_feature,

            json_group_array(
              json_set(
                e.feature,

                '$.properties.dispute.path_id',              b.path_id,
                '$.properties.dispute.path_edge_idx',        b.path_edge_idx,
                '$.properties.dispute.is_forward',           b.is_forward,
                '$.properties.dispute.edge_shst_match_idx',  b.edge_shst_match_idx,
                '$.properties.dispute.section_start',        b.section_start,
                '$.properties.dispute.section_end',          b.section_end,
                '$.properties.dispute.start_trimmable',      c.start_trimmable,
                '$.properties.dispute.end_trimmable',        c.end_trimmable
              )
            ) AS claimant_features

          FROM chosen_match_disputed_sections AS a
            INNER JOIN chosen_match_dispute_claimants AS b
              USING (dispute_id)
            INNER JOIN disputed_chosen_match_trimmability AS c
              USING (
                path_id,
                path_edge_idx,
                is_forward,
                edge_shst_match_idx
              )
            INNER JOIN source_map.shst_reference_features AS d
              USING (shst_reference_id)
            INNER JOIN target_map.target_map_ppg_edge_line_features AS e
              USING (edge_id)

          GROUP BY dispute_id ;
      `,
    )
    .raw()
    .iterate();

  for (const [
    disputeId,
    disputedSectionStart,
    disputedSectionEnd,
    shstRefStr,
    claimantStr,
  ] of iter) {
    const shstReference = JSON.parse(shstRefStr);
    const claimants = JSON.parse(claimantStr);

    yield {
      disputeId,
      disputedSectionStart,
      disputedSectionEnd,
      shstReference,
      claimants,
    };
  }
}
