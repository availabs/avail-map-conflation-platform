/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase } from 'better-sqlite3';

export default function createTrimmabilityTable(tmpDb: SqliteDatabase) {
  tmpDb.exec(
    readFileSync(join(__dirname, '../sql/create_trimmability_table.sql'), {
      encoding: 'utf8',
    }),
  );
}
