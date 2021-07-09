/* eslint-disable import/prefer-default-export */

import { getConflationBlkbrdSnapshotPath } from '../conflationDatabases/utils/conflationBlkbrdDbPaths';

import {
  outputSqliteDir,
  conflationInputMapsGpkgPath,
  getConflationBlkbrdSnapshotGpkgPath,
} from './utils/conflationSpatialPaths';

import createAllConflationInputMapsGpkg from './utils/createAllConflationInputMapsGpkg';
import createSnapshotGpkg from './utils/createConflationBlkbrdSnapshotGpkg';

export function createDevConflationInputMapsGpkg(overwrite: boolean = false) {
  createAllConflationInputMapsGpkg(
    conflationInputMapsGpkgPath,
    outputSqliteDir,
    overwrite,
  );
}

export function createConflationBlkbrdSnapshotGpkg(
  targetMap: string,
  timestamp: string,
) {
  const conflationBlkbrdSnapshotPath = getConflationBlkbrdSnapshotPath(
    targetMap,
    timestamp,
  );

  const conflationBlkbrdSnapshotGpkgPath = getConflationBlkbrdSnapshotGpkgPath(
    targetMap,
    timestamp,
  );

  createSnapshotGpkg(
    conflationInputMapsGpkgPath,
    conflationBlkbrdSnapshotPath,
    conflationBlkbrdSnapshotGpkgPath,
  );
}
