import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import conflationDevelopmentDataDir from '../../constants/conflationDevelopmentDataDir';

import validateTimestamp from '../../utils/validateTimestamp';
import SnapshotsFsUtils from '../../utils/SnapshotsFsUtils';
import DiffsFsUtils from '../../utils/DiffsFsUtils';

export const conflationSrcCodeDir = join(__dirname, '../../..');

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

export const codeSnapshotFsUtils = new SnapshotsFsUtils({
  dir: join(codeBackupsDir, 'snapshots'),
  nameCore: 'conflation_src_code_snapshot',
  ext: '',
  autoUpdateSymlinks: false,
});

export const codeDiffsFsUtils = new DiffsFsUtils({
  dir: join(codeBackupsDir, 'diffs'),
  nameCore: 'conflation_src_code_diff',
  ext: 'diff',
  autoUpdateSymlinks: false,
});
