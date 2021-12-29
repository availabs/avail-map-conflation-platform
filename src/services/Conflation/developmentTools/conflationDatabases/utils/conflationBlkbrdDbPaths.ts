import { join } from 'path';

import outputDirectory from '../../../../../constants/outputDirectory';

import conflationDevelopmentDataDir from '../../constants/conflationDevelopmentDataDir';

import SnapshotsByTargetMapFsUtils from '../../utils/SnapshotsByTargetMapFsUtils';
import DiffsByTargetMapFsUtils from '../../utils/DiffsByTargetMapFsUtils';

export const outputSqliteDir = join(outputDirectory, 'sqlite');

const conflationBlkbrdSnapshotsParentDir = join(
  conflationDevelopmentDataDir,
  'blackboard_dbs',
);

const conflationBlkbrdSnapshotsDir = join(
  conflationBlkbrdSnapshotsParentDir,
  'snapshots',
);

const conflationBlkbrdDiffsDir = join(
  conflationBlkbrdSnapshotsParentDir,
  'diffs',
);

export function getConflationBlkbrdDbName(targetMap: string) {
  return `${targetMap}_conflation_blackboard`;
}

export function getConflationBlkbrdDbPath(targetMap: string) {
  return join(outputSqliteDir, getConflationBlkbrdDbName(targetMap));
}

export const conflationBlkbrdSnapshotsFsUtils = new SnapshotsByTargetMapFsUtils(
  {
    dir: conflationBlkbrdSnapshotsDir,
    nameCore: 'conflation_blkbrd_snapshot',
    ext: 'sqlite3',
    autoUpdateSymlinks: true,
  },
);

export const conflationBlkbrdDiffsFsUtils = new DiffsByTargetMapFsUtils({
  dir: conflationBlkbrdDiffsDir,
  nameCore: 'conflation_blkbrd_diff',
  ext: 'sqlite3',
  autoUpdateSymlinks: true,
});
