import DbService from '../../../../services/DbService';

import { NPMRDS } from '../../../../constants/databaseSchemaNames';

export default function shrinkwrapDatabase() {
  DbService.shrinkwrapDatabase(NPMRDS);
}
