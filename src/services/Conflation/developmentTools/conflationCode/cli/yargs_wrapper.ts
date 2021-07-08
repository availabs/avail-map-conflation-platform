/* eslint-disable import/prefer-default-export */

import {
  createConflationCodeInitialBackup,
  createConflationCodeDifferentialBackup,
  createConflationCodeDiff,
} from '..';

import {
  getDifferentialCodeBackupTimestamps,
  getInitialDifferentialCodeBackupTimestamp,
  getLatestDifferentialCodeBackupTimestamp,
} from '../utils/conflationCodePaths';

const timestampBuilderElem = {
  type: 'string',
  describe: 'timestamp',
  demand: true,
  default: `${Math.round(Date.now() / 1000)}`,
};

const existingTimestampBuilderElem = {
  type: 'string',
  desc: 'Timestamp of an existing differential Conflation code backup.',
  demand: true,
  choices: getDifferentialCodeBackupTimestamps(),
};

/*
export const runCreateConflationCodeInitialBackup = {
  command: 'create_conflation_code_initial_backup',
  desc: 'Create the initial a backup of the Conflation src code.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp }) => {
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
  handler: ({ timestamp }) => createConflationCodeDifferentialBackup(timestamp),
};
*/

export const runCreateConflationCodeDiff = {
  command: 'create_conflation_code_diff',
  desc: 'Create a diff file based on Conflation differential backups.',
  builder: {
    a_timestamp: existingTimestampBuilderElem,
    b_timestamp: existingTimestampBuilderElem,
  },
  handler: ({ a_timestamp, b_timestamp }) =>
    createConflationCodeDiff(a_timestamp, b_timestamp),
};

export const fullConflationCodeSnapshot = {
  command: 'full_conflation_code_snapshot',
  desc:
    'Create snapshot as well as differential and incremental diff files for the snapshot.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp }) => {
    const initial = getInitialDifferentialCodeBackupTimestamp();
    const penult = getLatestDifferentialCodeBackupTimestamp();

    if (!initial) {
      createConflationCodeInitialBackup(timestamp);
    }

    createConflationCodeDifferentialBackup(timestamp);

    if (initial) {
      // Differential diff file
      createConflationCodeDiff(initial, timestamp);
    }

    if (penult) {
      // Incremental diff file
      createConflationCodeDiff(penult, timestamp);
    }
  },
};
