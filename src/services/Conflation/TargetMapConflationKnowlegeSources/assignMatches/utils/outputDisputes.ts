import { writeFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function outputGeoJSON(tmpDb: SqliteDatabase) {
  const result = tmpDb
    .prepare(
      `
        SELECT
            dispute_id,
            disputed_section_start,
            disputed_section_end,
            shst_reference_id,
            path_id,
            path_edge_idx,
            is_forward,
            edge_shst_match_idx,
            feature
          FROM source_map.shst_reference_features AS a
            INNER JOIN tmp_chosen_match_disputed_sections AS b
              USING (shst_reference_id)
            INNER JOIN tmp_chosen_match_dispute_claimants
              USING (dispute_id)
        UNION
        SELECT
            dispute_id,
            disputed_section_start,
            disputed_section_end,
            shst_reference_id,
            path_id,
            path_edge_idx,
            is_forward,
            edge_shst_match_idx,
            feature
          FROM source_map.shst_reference_features AS a
            INNER JOIN tmp_chosen_match_disputed_sections AS b
              USING (shst_reference_id)
            INNER JOIN tmp_chosen_match_dispute_claimants
              USING (dispute_id)
      `,
    )
    .all()
    .map(
      ({
        dispute_id,
        disputed_section_start,
        disputed_section_end,
        shst_reference_id,
        path_id,
        path_edge_idx,
        is_forward,
        edge_shst_match_idx,
        feature,
      }) => {
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
          is_forward,
          edge_shst_match_idx,
        };

        return disputedSection;
      },
    );

  writeFileSync(
    join(__dirname, '../data/disputedGeoms.geojson'),
    JSON.stringify(turf.featureCollection(result)),
  );
}
