import DbService from '../../../../../services/DbService';

import { SOURCE_MAP } from '../../../../../constants/databaseSchemaNames';

export default function shrinkwrapDatabase() {
  DbService.shrinkwrapDatabase(SOURCE_MAP);
}
