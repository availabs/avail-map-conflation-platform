import { readFileSync } from 'fs';
import { join } from 'path';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export const createOsmTables = (db: any) => {
  const sql = readFileSync(join(__dirname, './create_osm_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  db.exec(sql);
};

export { default as insertOsmNode } from './insertOsmNode';
export { default as insertOsmWay } from './insertOsmWay';
