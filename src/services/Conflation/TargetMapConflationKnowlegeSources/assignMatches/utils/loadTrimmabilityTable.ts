/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase } from 'better-sqlite3';

const sql = readFileSync(
  join(__dirname, '../sql/initialize_trimmability_table.sql'),
  {
    encoding: 'utf8',
  },
);

export default function loadTrimmabilityTable(db: SqliteDatabase) {
  db.exec(sql);
}
