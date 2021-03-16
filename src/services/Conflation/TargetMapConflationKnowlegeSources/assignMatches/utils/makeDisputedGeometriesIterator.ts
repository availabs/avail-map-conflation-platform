/* eslint-disable no-restricted-syntax */

import { Database as SqliteDatabase } from 'better-sqlite3';

import { ChosenMatchGeometryDisputes } from '../domain/types';

export default function* makeDisputedGeometriesIterator(
  tmpDb: SqliteDatabase,
): Generator<ChosenMatchGeometryDisputes> {
  const iter = tmpDb
    .prepare(
      `
        SELECT
            shst_geometry_id,

            json_group_object(
              shst_reference_id,
              json(shst_refs.feature)
            ) AS shst_references,

            json_group_array(
              json(dispute)
            ) AS disputes

          FROM (
            SELECT
                a.shst_geometry_id,

                a.shst_reference_id,

                json_object(
                  'disputeId',             a.dispute_id,

                  'disputedSectionStart',  a.disputed_section_start,
                  'disputedSectionEnd',    a.disputed_section_end,

                  'shstReferenceId',       a.shst_reference_id,

                  'claimant_features', 
                    json_group_array(
                      json_set(
                        e.feature,

                        '$.properties.dispute.targetMapPathId',             b.path_id,
                        '$.properties.dispute.targetMapPathEdgeIdx',        b.path_edge_idx,
                        '$.properties.dispute.isForward',                   b.is_forward,
                        '$.properties.dispute.targetMapEdgeShstMatchIdx',   b.edge_shst_match_idx,
                        '$.properties.dispute.sectionStart',                b.section_start,
                        '$.properties.dispute.sectionEnd',                  b.section_end,
                        '$.properties.dispute.startTrimmable',              c.start_trimmable,
                        '$.properties.dispute.endTrimmable',                c.end_trimmable
                      )
                    )
                ) AS dispute

              FROM tmp_chosen_match_disputed_sections AS a
                INNER JOIN tmp_chosen_match_dispute_claimants AS b
                  USING (dispute_id)
                INNER JOIN tmp_disputed_chosen_match_trimmability AS c
                  USING (
                    path_id,
                    path_edge_idx,
                    is_forward,
                    edge_shst_match_idx
                  )
                INNER JOIN target_map.target_map_ppg_edge_line_features AS e
                  USING (edge_id)

              GROUP BY dispute_id
          )
            INNER JOIN source_map.shst_reference_features AS shst_refs
              USING (shst_reference_id)

          GROUP BY shst_geometry_id
      `,
    )
    .raw()
    .iterate();

  for (const [shstGeometryId, shstRefsStr, disputesStr] of iter) {
    const shstReferences = JSON.parse(shstRefsStr);
    const disputes = JSON.parse(disputesStr);

    yield {
      shstGeometryId,
      shstReferences,
      disputes,
    };
  }
}
