/* eslint-disable import/prefer-default-export */

import {
  getConflationBlkbrdSnapshotPath,
  getConflationBlkbrdSnapshotsDiffPath,
} from '../conflationDatabases/utils/conflationBlkbrdDbPaths';

import {
  outputSqliteDir,
  conflationInputMapsGpkgPath,
  getConflationBlkbrdSnapshotGpkgPath,
  getConflationSnapshotDiffGpkgPath,
} from './utils/conflationSpatialPaths';

import createAllConflationInputMapsGpkg from './utils/createAllConflationInputMapsGpkg';
import createSnapshotGpkg from './utils/createConflationBlkbrdSnapshotGpkg';
import createDiffGpkg from './utils/createSnapshotDiffGpkg';

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

export function createConflationSnapshotDiffGpkg(
  targetMap: string,
  a_timestamp: string,
  b_timestamp: string,
) {
  const conflationSnapshotDiffPath = getConflationBlkbrdSnapshotsDiffPath(
    targetMap,
    a_timestamp,
    b_timestamp,
  );

  const conflationSnapshotDiffGpkgPath = getConflationSnapshotDiffGpkgPath(
    targetMap,
    a_timestamp,
    b_timestamp,
  );

  createDiffGpkg(
    conflationInputMapsGpkgPath,
    conflationSnapshotDiffPath,
    conflationSnapshotDiffGpkgPath,
  );
}
