import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import outputDirectory from '../../../../../constants/outputDirectory';

import conflationDevelopmentDataDir from '../../constants/conflationDevelopmentDataDir';
import validateTimestamp from '../../utils/validateTimestamp';

export const outputSqliteDir = join(outputDirectory, 'sqlite');

const conflationBlkbrdSnapshotsParentDir = join(
  conflationDevelopmentDataDir,
  'conflation_blackboard_dbs',
);

const checkTimestamp = (timestamp: string) => {
  if (!validateTimestamp(timestamp)) {
    throw new Error(`${timestamp} is not in UNIX timestamp format`);
  }
};

const conflationBlkbrdSnapshotsDir = join(
  conflationBlkbrdSnapshotsParentDir,
  'snapshots',
);

const conflationBlkbrdSnapshotsDiffDir = join(
  conflationBlkbrdSnapshotsParentDir,
  'snapshot_diffs',
);

const targetMapConflationBlkbrdSuffix = '_conflation_blackboard';

export function getConflationBlkbrdDbName(targetMap: string) {
  return `${targetMap}${targetMapConflationBlkbrdSuffix}`;
}

export function getConflationBlkbrdDbPath(targetMap: string) {
  return join(outputSqliteDir, getConflationBlkbrdDbName(targetMap));
}

const conflationBlkbrdSnapshotSuffix = '_snapshot.sqlite3';

export function getConflationBlkbrdSnapshotName(
  targetMap: string,
  timestamp: string,
) {
  checkTimestamp(timestamp);

  return `${getConflationBlkbrdDbName(
    targetMap,
  )}_${timestamp}${conflationBlkbrdSnapshotSuffix}`;
}

export function getConflationBlkbrdSnapshotPath(
  targetMap: string,
  timestamp: string,
) {
  return join(
    conflationBlkbrdSnapshotsDir,
    getConflationBlkbrdSnapshotName(targetMap, timestamp),
  );
}

const blkbrdSnapshotNameRE = new RegExp(
  `^[a-z_]{1,}_\\d{10}${conflationBlkbrdSnapshotSuffix}$`,
);

function getExistingBlkbrdSnapshotNames() {
  return existsSync(conflationBlkbrdSnapshotsDir)
    ? readdirSync(conflationBlkbrdSnapshotsDir, { withFileTypes: true })
        .filter(
          (dirent) => dirent.isFile() && blkbrdSnapshotNameRE.test(dirent.name),
        )
        .map(({ name }) => name)
        .sort() // ASSUMED ELSEWHERE
    : [];
}

export function getExistingBlkbrdSnapshotTimestampsByTargetMap() {
  const suffix = new RegExp(
    `_conflation_blackboard_\\d{10}${conflationBlkbrdSnapshotSuffix}$`,
  );

  const existingSnapshots = getExistingBlkbrdSnapshotNames();

  const timestampsByTargetMap = existingSnapshots.reduce(
    (acc: Record<string, string[]>, snapshotName) => {
      const targetMap = snapshotName.replace(suffix, '');

      // @ts-ignore
      const [timestamp] = snapshotName.match(/\d{10}/);

      acc[targetMap] = acc[targetMap] || [];

      acc[targetMap].push(timestamp);

      return acc;
    },
    {},
  );

  return timestampsByTargetMap;
}

export function getInitialBlkbrdSnapshotTimestampForTargetMap(
  targetMap: string,
) {
  const existingShapshotsByTargetMap = getExistingBlkbrdSnapshotTimestampsByTargetMap();

  const snapshotsForTargetMap = existingShapshotsByTargetMap[targetMap];

  return snapshotsForTargetMap?.length ? snapshotsForTargetMap[0] : null;
}

export function getInitialBlkbrdSnapshotNameForTargetMap(targetMap: string) {
  const timestamp = getInitialBlkbrdSnapshotTimestampForTargetMap(targetMap);

  return timestamp && getConflationBlkbrdSnapshotName(targetMap, timestamp);
}

export function getInitialBlkbrdSnapshotPathForTargetMap(targetMap: string) {
  const timestamp = getInitialBlkbrdSnapshotTimestampForTargetMap(targetMap);

  return timestamp && getConflationBlkbrdSnapshotPath(targetMap, timestamp);
}

export function getLatestBlkbrdSnapshotTimestampForTargetMap(
  targetMap: string,
) {
  const existingShapshotsByTargetMap = getExistingBlkbrdSnapshotTimestampsByTargetMap();

  const snapshotsForTargetMap = existingShapshotsByTargetMap[targetMap];

  return snapshotsForTargetMap?.length
    ? snapshotsForTargetMap[snapshotsForTargetMap.length - 1]
    : null;
}

export function getLatestBlkbrdSnapshotNameForTargetMap(targetMap: string) {
  const timestamp = getLatestBlkbrdSnapshotTimestampForTargetMap(targetMap);

  return timestamp && getConflationBlkbrdSnapshotName(targetMap, timestamp);
}

export function getLatestBlkbrdSnapshotPathForTargetMap(targetMap: string) {
  const timestamp = getLatestBlkbrdSnapshotTimestampForTargetMap(targetMap);

  return timestamp && getConflationBlkbrdSnapshotPath(targetMap, timestamp);
}

export function getConflationBlkbrdSnapshotsDiffName(
  targetMap: string,
  a_timestamp: string,
  b_timestamp: string,
) {
  checkTimestamp(a_timestamp);
  checkTimestamp(b_timestamp);

  return `${getConflationBlkbrdDbName(
    targetMap,
  )}_${a_timestamp}-${b_timestamp}_snapshots_diff.sqlite3`;
}

export function getConflationBlkbrdSnapshotsDiffPath(
  targetMap: string,
  a_timestamp: string,
  b_timestamp: string,
) {
  return join(
    conflationBlkbrdSnapshotsDiffDir,
    getConflationBlkbrdSnapshotsDiffName(targetMap, a_timestamp, b_timestamp),
  );
}
