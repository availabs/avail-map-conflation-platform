import { writeFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function outputChosenMatches(tmpDb: SqliteDatabase) {
  const result = tmpDb
    .prepare(
      `
        SELECT
            path_id,
            path_edge_idx,
            edge_id,
            is_forward,
            edge_shst_match_idx,
            section_start,
            section_end,
            feature
          FROM source_map.shst_reference_features AS a
            INNER JOIN target_map_bb.target_map_edge_chosen_matches AS b
              ON (a.shst_reference_id = b.shst_reference) ;
      `,
    )
    .all()
    .map(
      ({
        path_id,
        path_edge_idx,
        edge_id,
        is_forward,
        edge_shst_match_idx,
        section_start,
        section_end,
        feature,
      }) => {
        const shstRef = JSON.parse(feature);

        const chosenMatch = turf.lineSliceAlong(
          shstRef,
          section_start,
          section_end,
        );

        chosenMatch.id = shstRef.id;
        chosenMatch.properties = {
          shstReferenceId: shstRef.id,
          roadClass: shstRef.properties.minOsmRoadClass,
          path_id,
          path_edge_idx,
          edge_id,
          is_forward,
          edge_shst_match_idx,
          section_start,
          section_end,
        };

        return chosenMatch;
      },
    );

  writeFileSync(
    join(__dirname, '../data/chosenMatches.geojson'),
    JSON.stringify(turf.featureCollection(result)),
  );
}
