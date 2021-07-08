import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import conflationDevelopmentDataDir from '../../constants/conflationDevelopmentDataDir';
import validateTimestamp from '../../utils/validateTimestamp';

export const conflationSrcCodeDir = join(__dirname, '../../..');
console.log(conflationSrcCodeDir);

const codeBackupsDir = join(conflationDevelopmentDataDir, 'code_backups');

const initialCodeBackupParentDir = join(codeBackupsDir, 'initial');

const initialCodeBackupNamePrefix = 'conflation_src_code_initial_backup_';

export function getInitialCodeBackupDir() {
  if (!existsSync(initialCodeBackupParentDir)) {
    return null;
  }

  const entries = readdirSync(initialCodeBackupParentDir);

  if (entries.length > 1) {
    throw new Error(
      `More than one backup found in ${initialCodeBackupParentDir}.`,
    );
  }

  return entries.length ? join(initialCodeBackupParentDir, entries[0]) : null;
}

export function getInitialCodeBackupDirForTimestamp(timestamp: string) {
  if (!validateTimestamp) {
    throw new Error(`${timestamp} is not in UNIX timestamp format.`);
  }

  return join(
    initialCodeBackupParentDir,
    `${initialCodeBackupNamePrefix}${timestamp}`,
  );
}

export const differentialCodeBackupsDir = join(codeBackupsDir, 'differential');

const differentialCodeBackupNamePrefix =
  'conflation_src_code_differential_backup_';

export const getDifferentialCodeBackupTimestamps = () =>
  existsSync(differentialCodeBackupsDir)
    ? readdirSync(differentialCodeBackupsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map(({ name }) =>
          name.replace(new RegExp(`^${differentialCodeBackupNamePrefix}`), ''),
        )
        .filter((ts) => validateTimestamp(ts))
        .sort()
    : [];

export const getInitialDifferentialCodeBackupTimestamp = () => {
  const tstamps = getDifferentialCodeBackupTimestamps();

  return tstamps.length ? tstamps[0] : null;
};

export const getLatestDifferentialCodeBackupTimestamp = () => {
  const tstamps = getDifferentialCodeBackupTimestamps();

  return tstamps.length ? tstamps[tstamps.length - 1] : null;
};

export const codeDiffsDir = join(codeBackupsDir, 'diffs');

export function getDifferentialCodeBackupDirForTimestamp(timestamp: string) {
  if (!validateTimestamp(timestamp)) {
    throw new Error(`ERROR: ${timestamp} must be in UNIX timestamp format.`);
  }

  const differentialBackupDir = join(
    differentialCodeBackupsDir,
    `${differentialCodeBackupNamePrefix}${timestamp}`,
  );

  return differentialBackupDir;
}

export function getCodeDiffFilePathForTimestamps(
  a_timestamp: string,
  b_timestamp: string,
) {
  return join(
    codeDiffsDir,
    `conflation_src_code_diff.${a_timestamp}-${b_timestamp}.diff`,
  );
}
