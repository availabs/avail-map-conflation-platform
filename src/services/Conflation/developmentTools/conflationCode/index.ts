import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

import validateTimestamp from '../utils/validateTimestamp';

import {
  conflationSrcCodeDir,
  getInitialCodeBackupDir,
  getInitialCodeBackupDirForTimestamp,
  codeDiffsDir,
  getDifferentialCodeBackupDirForTimestamp,
  getCodeDiffFilePathForTimestamps,
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
    throw new Error('Initial conflation code snapshot already exists');
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

  const differentialCodeBackupDir = getDifferentialCodeBackupDirForTimestamp(
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
  const diffBackupDirA = getDifferentialCodeBackupDirForTimestamp(a_timestamp);
  const diffBackupDirB = getDifferentialCodeBackupDirForTimestamp(b_timestamp);

  const errMsgs: string[] = [];

  if (!existsSync(diffBackupDirA)) {
    errMsgs.push(`Differential backup ${a_timestamp} does not exist.`);
  }

  if (!existsSync(diffBackupDirB)) {
    errMsgs.push(`Differential backup ${b_timestamp} does not exist.`);
  }

  if (errMsgs.length) {
    throw new Error(errMsgs.join('\n'));
  }

  mkdirSync(codeDiffsDir, { recursive: true });

  const diffFilePath = getCodeDiffFilePathForTimestamps(
    a_timestamp,
    b_timestamp,
  );

  // https://unix.stackexchange.com/a/156305
  execSync(
    `bash -c \
      'diff -Nur ${diffBackupDirA} ${diffBackupDirB} \
      > ${diffFilePath}'; (true)
    `,
  );

  return diffFilePath;
}
