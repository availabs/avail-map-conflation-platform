/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function createAssignedMatchesTable(db: SqliteDatabase) {
  db.exec(
    readFileSync(join(__dirname, '../sql/create_assigned_matches_table.sql'), {
      encoding: 'utf8',
    }),
  );
}
