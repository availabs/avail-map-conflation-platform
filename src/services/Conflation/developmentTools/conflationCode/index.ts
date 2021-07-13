import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

import validateTimestamp from '../utils/validateTimestamp';

import {
  conflationSrcCodeDir,
  getInitialCodeBackupDir,
  getInitialCodeBackupDirForTimestamp,
  codeSnapshotFsUtils,
  codeDiffsFsUtils,
} from './utils/conflationCodePaths';

const checkTimestamp = (timestamp: string) => {
  if (!validateTimestamp(timestamp)) {
    throw new Error('Timestamps must be in UNIX timestamp format.');
  }
};

export function createConflationCodeInitialBackup(timestamp: string) {
  checkTimestamp(timestamp);

  const initialCodeBackupDir = getInitialCodeBackupDir();

  if (initialCodeBackupDir !== null) {
    console.log('Initial conflation code snapshot already exists');
    return;
  }

  const backupDir = getInitialCodeBackupDirForTimestamp(timestamp);

  mkdirSync(backupDir, { recursive: true });

  execSync(`
    rsync \
      -av \
      ${conflationSrcCodeDir} \
      ${backupDir}
  `);
}

export function createConflationCodeDifferentialBackup(timestamp: string) {
  checkTimestamp(timestamp);

  const initialCodeBackupDir = getInitialCodeBackupDir();

  if (initialCodeBackupDir === null) {
    throw new Error('ERROR: Initial conflation code snapshot does not exist');
  }

  const differentialCodeBackupDir = codeSnapshotFsUtils.getSnapshotPath(
    timestamp,
  );

  mkdirSync(differentialCodeBackupDir, { recursive: true });

  execSync(`
    rsync \
      -av \
      ${conflationSrcCodeDir} \
      --compare-dest=${initialCodeBackupDir} \
      ${differentialCodeBackupDir}
  `);

  return differentialCodeBackupDir;
}

export function createConflationCodeDiff(
  a_timestamp: string,
  b_timestamp: string,
) {
  const snapshotDirA = codeSnapshotFsUtils.getSnapshotPath(a_timestamp);
  const snapshotDirB = codeSnapshotFsUtils.getSnapshotPath(b_timestamp);

  const errMsgs: string[] = [];

  if (!existsSync(snapshotDirA)) {
    errMsgs.push(`Differential backup ${a_timestamp} does not exist.`);
  }

  if (!existsSync(snapshotDirB)) {
    errMsgs.push(`Differential backup ${b_timestamp} does not exist.`);
  }

  if (errMsgs.length) {
    throw new Error(errMsgs.join('\n'));
  }

  mkdirSync(codeDiffsFsUtils.dir, { recursive: true });

  const diffFilePath = codeDiffsFsUtils.getDiffPath([a_timestamp, b_timestamp]);

  // https://unix.stackexchange.com/a/156305
  execSync(
    `bash -c \
      'diff -Nur ${snapshotDirA} ${snapshotDirB} \
      > ${diffFilePath}'; (true)
    `,
  );

  return diffFilePath;
}
