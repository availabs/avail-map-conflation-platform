/* eslint-disable import/prefer-default-export */

import { readFileSync } from 'fs';
import { join } from 'path';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export default function finishSharedStreetsLoad(db: any) {
  const sql = readFileSync(join(__dirname, './create_shst_join_views.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  db.exec(sql);
}
