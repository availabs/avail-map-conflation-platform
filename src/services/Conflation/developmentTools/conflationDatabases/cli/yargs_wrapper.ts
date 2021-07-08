/* eslint-disable import/prefer-default-export */

import {
  createBlkbrdDatabaseSnapshot,
  createBlkbrdDatabaseSnapshotsDiff,
} from '..';

import {
  getExistingBlkbrdSnapshotTimestampsByTargetMap,
  getInitialBlkbrdSnapshotTimestampForTargetMap,
  getLatestBlkbrdSnapshotTimestampForTargetMap,
} from '../utils/conflationBlkbrdDbPaths';

const timestampBuilderElem = {
  type: 'string',
  describe: 'timestamp (defaults to current timestamp)',
  demand: false,
};

const existingTimestampBuilderElem = {
  type: 'string',
  desc:
    'Timestamp of an existing differential Conflation Blackboard database snapshot.',
  demand: true,
};

const currentTimestamp = `${Math.round(Date.now() / 1000)}`;

const nysRisBlkbrdSnapshotTimestamps =
  getExistingBlkbrdSnapshotTimestampsByTargetMap().nys_ris || [];

const npmrdsBlkbrdSnapshotTimestamps =
  getExistingBlkbrdSnapshotTimestampsByTargetMap().npmrds || [];

export const snapshotNysRisConflationBlackboardDatabase = {
  command: 'create_nys_ris_conflation_blackboard_database_snapshot',
  desc:
    'Create a snapshot of the ShstMatches, ChosenMatches, and AssignedMatches in the NYS RIS Conflation Blackboard database.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp = currentTimestamp }) =>
    createBlkbrdDatabaseSnapshot('nys_ris', timestamp),
};

export const snapshotNpmrdsConflationBlackboardDatabase = {
  command: 'create_npmrds_conflation_blackboard_database_snapshot',
  desc:
    'Create a snapshot of the ShstMatches, ChosenMatches, and AssignedMatches in the NPMRDS Conflation Blackboard database.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp = currentTimestamp }) =>
    createBlkbrdDatabaseSnapshot('npmrds', timestamp),
};

export const snapshotConflationBlackboardDatabases = {
  command: 'create_conflation_blackboard_database_snapshots',
  desc:
    'Create a snapshot of the ShstMatches, ChosenMatches, and AssignedMatches in the NYS RIS and NPMRDS Conflation Blackboard databases.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp = currentTimestamp }) => {
    createBlkbrdDatabaseSnapshot('nys_ris', timestamp);
    createBlkbrdDatabaseSnapshot('npmrds', timestamp);
  },
};

export const diffNysRisConflationBlackboardDatabaseSnapshots = {
  command: 'create_nys_ris_conflation_blackboard_database_snapshots_diff',
  desc:
    'Create a diff database of two NYS RIS Conflation Blackboard snapshots.',
  builder: {
    a_timestamp: {
      ...existingTimestampBuilderElem,
      choices: nysRisBlkbrdSnapshotTimestamps,
    },
    b_timestamp: {
      ...existingTimestampBuilderElem,
      choices: nysRisBlkbrdSnapshotTimestamps,
    },
  },
  handler: ({ a_timestamp, b_timestamp }) =>
    createBlkbrdDatabaseSnapshotsDiff('nys_ris', a_timestamp, b_timestamp),
};

export const diffNpmrdsConflationBlackboardDatabaseSnapshots = {
  command: 'create_npmrds_conflation_blackboard_database_snapshots_diff',
  desc: 'Create a diff database of two NPMRDS Conflation Blackboard snapshots.',
  builder: {
    a_timestamp: {
      ...existingTimestampBuilderElem,
      choices: npmrdsBlkbrdSnapshotTimestamps,
    },
    b_timestamp: {
      ...existingTimestampBuilderElem,
      choices: npmrdsBlkbrdSnapshotTimestamps,
    },
  },
  handler: ({ a_timestamp, b_timestamp }) =>
    createBlkbrdDatabaseSnapshotsDiff('npmrds', a_timestamp, b_timestamp),
};

export const fullConflationBlackboardSnapshot = {
  command: 'full_conflation_blackboard_snapshot',
  desc:
    'Create snapshot and diff databases for NYS RIS and NPMRDS Conflation Blackboards.',
  builder: {
    timestamp: timestampBuilderElem,
  },
  handler: ({ timestamp = currentTimestamp }) => {
    ['nys_ris', 'npmrds'].forEach((targetMap) => {
      const initial = getInitialBlkbrdSnapshotTimestampForTargetMap(targetMap);
      const penult = getLatestBlkbrdSnapshotTimestampForTargetMap(targetMap);

      createBlkbrdDatabaseSnapshot(targetMap, timestamp);

      if (initial) {
        // Differential diff db snapshot
        createBlkbrdDatabaseSnapshotsDiff(targetMap, initial, timestamp);
      }

      if (penult && initial !== penult) {
        // Incremental diff db snapshot
        createBlkbrdDatabaseSnapshotsDiff(targetMap, penult, timestamp);
      }
    });
  },
};
