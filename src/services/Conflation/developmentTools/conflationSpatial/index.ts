/* eslint-disable import/prefer-default-export */

import {
  conflationBlkbrdSnapshotsFsUtils,
  conflationBlkbrdDiffsFsUtils,
} from '../conflationDatabases/utils/conflationBlkbrdDbPaths';

import {
  outputSqliteDir,
  conflationInputMapsGpkgPath,
  conflationBlkbrdSnapshotsGpkgFsUtils,
  conflationBlkbrdDiffsGpkgFsUtils,
  getOsmPbfFilePath,
} from './utils/conflationSpatialPaths';

import createAllConflationInputMapsGpkg from './utils/createAllConflationInputMapsGpkg';
import createSnapshotGpkg from './utils/createConflationBlkbrdSnapshotGpkg';
import createDiffGpkg from './utils/createSnapshotDiffGpkg';

export function createDevConflationInputMapsGpkg(overwrite: boolean = false) {
  createAllConflationInputMapsGpkg(
    conflationInputMapsGpkgPath,
    outputSqliteDir,
    getOsmPbfFilePath(),
    overwrite,
  );
}

export function createConflationBlkbrdSnapshotGpkg(
  targetMap: string,
  timestamp: string,
) {
  const conflationBlkbrdSnapshotPath = conflationBlkbrdSnapshotsFsUtils.getSnapshotPath(
    targetMap,
    timestamp,
  );

  const conflationBlkbrdSnapshotGpkgPath = conflationBlkbrdSnapshotsGpkgFsUtils.getSnapshotPath(
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
  timestamps: [string, string],
) {
  const conflationSnapshotDiffPath = conflationBlkbrdDiffsFsUtils.getDiffPath(
    targetMap,
    timestamps,
  );

  const conflationSnapshotDiffGpkgPath = conflationBlkbrdDiffsGpkgFsUtils.getDiffPath(
    targetMap,
    timestamps,
  );

  createDiffGpkg(
    conflationInputMapsGpkgPath,
    conflationSnapshotDiffPath,
    conflationSnapshotDiffGpkgPath,
  );
}
