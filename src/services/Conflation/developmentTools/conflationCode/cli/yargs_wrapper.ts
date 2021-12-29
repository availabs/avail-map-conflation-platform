/* eslint-disable import/prefer-default-export */

import {
  createConflationCodeInitialBackup,
  createConflationCodeDifferentialBackup,
  createConflationCodeDiff,
} from '..';

import {
  codeSnapshotFsUtils,
  codeDiffsFsUtils,
} from '../utils/conflationCodePaths';

const currentTimestamp = `${Math.round(Date.now() / 1000)}`;

const timestampBuilderElem = {
  type: 'string',
  describe: 'timestamp (defaults to current timestamp)',
  demand: false,
};

const existingTimestampBuilderElem = {
  type: 'string',
  desc:
    'Timestamp of an existing differential Conflation code backup. NOTE: a_timestamp should preceed b_timestamp.',
  demand: true,
};

export const runCreateConflationCodeInitialBackup = {
  command: 'create_conflation_code_initial_backup',
  desc: 'Create the initial a backup of the Conflation src code.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp = currentTimestamp }) => {
    createConflationCodeInitialBackup(timestamp);
    createConflationCodeDifferentialBackup(timestamp); // For incrementals
  },
};

export const runCreateConflationCodeDifferentialBackup = {
  command: 'create_conflation_code_differential_backup',
  desc: 'Create a differential backup of the Conflation src code.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp = currentTimestamp }) =>
    createConflationCodeDifferentialBackup(timestamp),
};

export const runCreateConflationCodeDiff = {
  command: 'create_conflation_code_diff',
  desc: 'Create a diff file based on Conflation differential backups.',
  builder: {
    a_timestamp: {
      ...existingTimestampBuilderElem,
      choices: codeSnapshotFsUtils.existingSnapshotTimestamps.slice(0, -1),
    },
    b_timestamp: {
      ...existingTimestampBuilderElem,
      choices: codeSnapshotFsUtils.existingSnapshotTimestamps.slice(1),
    },
  },
  handler: ({ a_timestamp, b_timestamp }) =>
    createConflationCodeDiff(a_timestamp, b_timestamp),
};

export const fullConflationCodeSnapshot = {
  command: 'full_conflation_code_snapshot',
  desc:
    'Create snapshot, differential and incremental diff files, and update the latest_differential.diff and latest_incremental.diff symbolic links.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp = currentTimestamp }) => {
    const initial = codeSnapshotFsUtils.initialSnapshotTimestamp;
    const penult = codeSnapshotFsUtils.latestSnapshotTimestamp;

    if (!initial) {
      createConflationCodeInitialBackup(timestamp);
    }

    createConflationCodeDifferentialBackup(timestamp);

    if (initial) {
      // Differential diff file
      createConflationCodeDiff(initial, timestamp);
    }

    if (penult && penult !== initial) {
      // Incremental diff file
      createConflationCodeDiff(penult, timestamp);
    }
  },
};

export const updateSymlinks = {
  command: 'update_conflation_code_symlinks',
  desc: 'update the snapshot and diff symlinks',
  handler: () => {
    codeSnapshotFsUtils.updateSnapshotSymlinks();
    codeDiffsFsUtils.updateDiffSymlinks();
  },
};
