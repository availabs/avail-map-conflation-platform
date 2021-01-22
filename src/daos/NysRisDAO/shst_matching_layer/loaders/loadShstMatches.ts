/* eslint-disable no-restricted-syntax */

import TargetMapConflationController from '../../../../services/Conflation/TargetMapConflationController';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

export default async function loadShstMatches() {
  const targetMapConflationController = new TargetMapConflationController(
    SCHEMA,
  );

  await targetMapConflationController.conflate();
}
