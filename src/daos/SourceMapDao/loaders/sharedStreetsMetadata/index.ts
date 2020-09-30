import { readFileSync } from 'fs';
import { join } from 'path';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export const createSharedStreetsMetadataTables = (db: any) => {
  const sql = readFileSync(join(__dirname, './create_shst_metadata_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  db.exec(sql);
};

export { default as insertSharedStreetsMetadata } from './insertSharedStreetsMetadata';
