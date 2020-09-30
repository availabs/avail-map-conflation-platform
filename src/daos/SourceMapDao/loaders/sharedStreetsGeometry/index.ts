import { readFileSync } from 'fs';
import { join } from 'path';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export const createSharedStreetsGeometryTables = (db: any) => {
  const sql = readFileSync(join(__dirname, './create_shst_geometry_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  db.exec(sql);
};

export { default as insertSharedStreetsGeometry } from './insertSharedStreetsGeometry';
