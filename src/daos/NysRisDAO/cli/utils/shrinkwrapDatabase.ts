import DbService from '../../../../services/DbService';

import { NYS_RIS } from '../../../../constants/databaseSchemaNames';

export default function shrinkwrapDatabase() {
  DbService.shrinkwrapDatabase(NYS_RIS);
}
