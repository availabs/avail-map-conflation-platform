import { readFileSync } from 'fs';
import { join } from 'path';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export const createSharedStreetsIntersectionTables = (db: any) => {
  const sql = readFileSync(
    join(__dirname, './create_shst_intersection_tables.sql'),
  )
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  db.exec(sql);
};

export { default as insertSharedStreetsIntersection } from './insertSharedStreetsIntersection';
