import DbService from '../../../../../services/DbService';

import { SOURCE_MAP } from '../../../../../constants/databaseSchemaNames';

export default function shrinkwrapDatabase() {
  const db = DbService.openConnectionToDb(SOURCE_MAP, null, 'shst');

  db.pragma('shst.journal_mode = DELETE;');

  db.close();

  DbService.makeDatabaseReadonly(SOURCE_MAP);
}
