import { existsSync, readdirSync, unlinkSync, symlinkSync } from 'fs';
import { join, relative, dirname } from 'path';

import conflationDevelopmentDataDir from '../../constants/conflationDevelopmentDataDir';
import validateTimestamp from '../../utils/validateTimestamp';

export const conflationSrcCodeDir = join(__dirname, '../../..');

const codeBackupsDir = join(conflationDevelopmentDataDir, 'code_backups');

export const differentialCodeBackupsDir = join(codeBackupsDir, 'differential');

export const codeDiffsDir = join(codeBackupsDir, 'diffs');

export const latestDifferentialCodeDiffSymlinkPath = join(
  codeDiffsDir,
  'latest_differential.diff',
);
export const latestIncrementalCodeDiffSymlinkPath = join(
  codeDiffsDir,
  'latest_incremental.diff',
);

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

export const getPenultimateDifferentialCodeBackupTimestamp = () => {
  const tstamps = getDifferentialCodeBackupTimestamps();

  return tstamps.length > 1 ? tstamps[tstamps.length - 2] : null;
};

export const getLatestDifferentialCodeBackupTimestamp = () => {
  const tstamps = getDifferentialCodeBackupTimestamps();

  return tstamps.length ? tstamps[tstamps.length - 1] : null;
};

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

const codeDiffFileNameRE = /^conflation_src_code_diff\.\d{10}-\d{10}\.diff$/;

export function getCodeDiffFileNames() {
  return existsSync(codeDiffsDir)
    ? readdirSync(codeDiffsDir, { withFileTypes: true })
        .filter(
          (dirent) => dirent.isFile() && codeDiffFileNameRE.test(dirent.name),
        )
        .map(({ name }) => name)
        .sort()
    : [];
}

export function getLatestDifferentialCodeDiffFilePath() {
  const initialTimestamp = getInitialDifferentialCodeBackupTimestamp();

  if (!initialTimestamp) {
    return null;
  }

  const differentialCodeDiffFileNameRE = new RegExp(
    `^conflation_src_code_diff\\.${initialTimestamp}-\\d{10}\\.diff$`,
  );

  const differentials = getCodeDiffFileNames().filter((p) =>
    differentialCodeDiffFileNameRE.test(p),
  );

  return differentials.length
    ? join(codeDiffsDir, differentials[differentials.length - 1])
    : null;
}

// NOTE: Assumes a_timestamp < b_timestamp
export function getLatestIncrementalCodeDiffFilePath() {
  const codeDiffFilePaths = getCodeDiffFileNames();

  return codeDiffFilePaths.length
    ? join(codeDiffsDir, codeDiffFilePaths[codeDiffFilePaths.length - 1])
    : null;
}

export function updateLatestDifferentialCodeDiffSymLink() {
  const codeDiffFilePath = getLatestDifferentialCodeDiffFilePath();

  if (codeDiffFilePath === null) {
    return;
  }

  try {
    unlinkSync(latestDifferentialCodeDiffSymlinkPath);
  } catch (err) {
    // noop
  }

  symlinkSync(
    relative(dirname(latestDifferentialCodeDiffSymlinkPath), codeDiffFilePath),
    latestDifferentialCodeDiffSymlinkPath,
  );
}

export function updateLatestIncrementalCodeDiffSymLink() {
  const codeDiffFilePath = getLatestIncrementalCodeDiffFilePath();

  if (codeDiffFilePath === null) {
    return;
  }

  try {
    unlinkSync(latestIncrementalCodeDiffSymlinkPath);
  } catch (err) {
    // noop
  }

  symlinkSync(
    relative(dirname(latestIncrementalCodeDiffSymlinkPath), codeDiffFilePath),
    latestIncrementalCodeDiffSymlinkPath,
  );
}

export function updateSymlinks() {
  updateLatestDifferentialCodeDiffSymLink();
  updateLatestIncrementalCodeDiffSymLink();
}
