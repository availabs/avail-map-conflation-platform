import TargetMapConflationController from '../../../../services/Conflation/TargetMapConflationController';

import { TEST_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export default async function loadShstMatches() {
  const targetMapConflationController = new TargetMapConflationController(
    SCHEMA,
  );

  await targetMapConflationController.conflate();
}
