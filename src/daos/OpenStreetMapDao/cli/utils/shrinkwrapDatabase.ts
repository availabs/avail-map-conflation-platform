import DbService from '../../../../services/DbService';

import { OSM } from '../../../../constants/databaseSchemaNames';

export default function shrinkwrapDatabase() {
  DbService.shrinkwrapDatabase(OSM);
}
