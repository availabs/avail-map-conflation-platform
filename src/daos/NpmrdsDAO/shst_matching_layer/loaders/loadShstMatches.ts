import TargetMapConflationController from '../../../../services/Conflation/TargetMapConflationController';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

export default async function loadShstMatches() {
  const targetMapConflationController = new TargetMapConflationController(
    SCHEMA,
  );

  targetMapConflationController.clean();
  await targetMapConflationController.conflate();
}
