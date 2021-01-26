import db from '../../../../services/DbService';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import loadMicroLevel from './loadMicroLevel';
import loadMesoLevel from './loadMesoLevel';

export default function loadTargetMap() {
  db.makeDatabaseWritable(SCHEMA);
  loadMicroLevel();
  loadMesoLevel();
  db.makeDatabaseReadOnly(SCHEMA);
}
