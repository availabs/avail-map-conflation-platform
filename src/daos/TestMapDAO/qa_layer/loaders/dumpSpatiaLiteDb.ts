/* eslint-disable no-restricted-syntax */

import { join } from 'path';

import * as turf from '@turf/turf';

import DbService from '../../../../services/DbService';

import SpatiaLiteWriter from '../../../../services/Conflation/developmentTools/conflationSpatial/utils/SpatiaLiteWriter';

import {
  TEST_MAP as SCHEMA,
  SOURCE_MAP,
} from '../../../../constants/databaseSchemaNames';

import ouputDirectory from '../../../../constants/outputDirectory';

export default function dumpQASpatiaLiteDB() {
  const db = DbService.openConnectionToDb(`${SCHEMA}_qa`);

  DbService.attachDatabaseToConnection(db, `${SCHEMA}`, null, 'test_map');

  DbService.attachDatabaseToConnection(
    db,
    `${SCHEMA}_conflation_blackboard`,
    null,
    'test_map_bb',
  );

  DbService.attachDatabaseToConnection(db, SOURCE_MAP);

  db.function(
    'line_slice_along',
    (featureStr, section_start, section_end) => {
      const feature = JSON.parse(featureStr);

      const slice = turf.lineSliceAlong(feature, +section_start, +section_end);

      return JSON.stringify(slice);
    },
    { deterministic: true },
  );

  const dbPath = join(ouputDirectory, 'sqlite', `${SCHEMA}_qa_gis.sqlite3`);

  const shstRefsWriter = new SpatiaLiteWriter('shst_references', dbPath, true);

  const shstRefsIter = db
    .prepare(
      `
    SELECT
        feature AS feature_str
      FROM source_map.shst_reference_features
  `,
    )
    .iterate();

  for (const { feature_str } of shstRefsIter) {
    const feature = JSON.parse(feature_str);

    shstRefsWriter.write(feature);
  }

  shstRefsWriter.close();

  const matchesWriter = new SpatiaLiteWriter('matches', dbPath, false);

  const matchesIter = db
    .prepare(
      `
        SELECT
            b.id,

            c.shst_reference AS shst_ref_in,
            b.shst_reference AS shst_ref_out,

            b.match_taxonomy,

            json(
              line_slice_along(
                json_remove(a.feature, '$.properties'),
                b.section_start,
                b.section_end
              )
            ) AS feature_str

          FROM source_map.shst_reference_features AS a
            INNER JOIN test_map_qa.assigned_match_analysis AS b
              ON ( a.shst_reference_id = b.shst_reference )
            INNER JOIN test_map_qa.ground_truth AS c
              USING ( edge_id )
      `,
    )
    .iterate();

  for (const {
    id,
    shst_ref_in,
    shst_ref_out,
    match_taxonomy,
    feature_str,
  } of matchesIter) {
    const feature = JSON.parse(feature_str);
    feature.properties = {
      id,
      shst_ref_in,
      shst_ref_out,
      taxonomy: JSON.parse(match_taxonomy).join(':'),
    };

    matchesWriter.write(feature);
  }

  matchesWriter.close();
}
