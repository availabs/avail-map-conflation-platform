import TargetMapController from './TargetMapController';

import { NPMRDS } from '../../src/constants/databaseSchemaNames';

const npmrdsTargetMapController = new TargetMapController(NPMRDS);

export default npmrdsTargetMapController;
