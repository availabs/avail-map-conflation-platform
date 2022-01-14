import { readFileSync } from 'fs';
import { join } from 'path';

import DbService from '../../../../services/DbService';

import {
  TEST_MAP as SCHEMA,
  SOURCE_MAP,
} from '../../../../constants/databaseSchemaNames';

const sql = readFileSync(join(__dirname, './sql/qa_tables.sql'), {
  encoding: 'utf8',
});

export default function loadShstMatches() {
  const db = DbService.openConnectionToDb(`${SCHEMA}_qa`);

  DbService.attachDatabaseToConnection(db, `${SCHEMA}`, null, 'test_map');

  DbService.attachDatabaseToConnection(
    db,
    `${SCHEMA}_conflation_blackboard`,
    null,
    'test_map_bb',
  );

  DbService.attachDatabaseToConnection(db, SOURCE_MAP);

  // TODO: Programatically drop all test_map_bb.qa_* tables.

  db.exec(sql);
}
