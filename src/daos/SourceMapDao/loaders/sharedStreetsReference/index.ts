import { readFileSync } from 'fs';
import { join } from 'path';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export const createSharedStreetsReferenceTables = (db: any) => {
  const sql = readFileSync(
    join(__dirname, './create_shst_reference_tables.sql'),
  )
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  db.exec(sql);
};

export { default as insertSharedStreetsReference } from './insertSharedStreetsReference';
