/* eslint-disable import/prefer-default-export */

import {
  createBlkbrdDatabaseSnapshot,
  createBlkbrdDatabaseSnapshotsDiff,
} from '..';

import {
  conflationBlkbrdSnapshotsFsUtils,
  conflationBlkbrdDiffsFsUtils,
} from '../utils/conflationBlkbrdDbPaths';

const targetMaps = ['nys_ris', 'npmrds'];

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

const existingBlkbrdSnapshotTimestampsByTargetMap =
  conflationBlkbrdSnapshotsFsUtils.existingSnapshotTimestampsByTargetMap;

const commonExistingBlkbrdSnapshotTimestamps =
  conflationBlkbrdSnapshotsFsUtils.commonExistingTimestamps;

export const snapshotConflationBlackboardDatabases = {
  command: 'create_conflation_blackboard_database_snapshots',
  desc:
    "Create a snapshot of the ShstMatches, ChosenMatches, and AssignedMatches in the TargetMaps' Conflation Blackboard databases.",
  builder: {
    target_maps: {
      type: 'array',
      descript: 'TargetMaps',
      demand: true,
      choices: targetMaps,
      default: targetMaps,
    },
    timestamp: timestampBuilderElem,
  },
  handler: ({ target_maps, timestamp = currentTimestamp }) =>
    target_maps.forEach((targetMap: string) =>
      createBlkbrdDatabaseSnapshot(targetMap, timestamp),
    ),
};

export const diffNysRisConflationBlackboardDatabaseSnapshots = {
  command: 'nys_ris_create_conflation_blackboard_database_snapshots_diff',
  desc:
    'Create a diff database of two NYS RIS Conflation Blackboard snapshots.',
  builder: {
    a_timestamp: {
      ...existingTimestampBuilderElem,
      choices:
        existingBlkbrdSnapshotTimestampsByTargetMap?.nys_ris?.slice(1) || [],
    },
    b_timestamp: {
      ...existingTimestampBuilderElem,
      choices:
        existingBlkbrdSnapshotTimestampsByTargetMap?.nys_ris?.slice(0, -1) ||
        [],
    },
  },
  handler: ({ a_timestamp, b_timestamp }) =>
    createBlkbrdDatabaseSnapshotsDiff('nys_ris', [a_timestamp, b_timestamp]),
};

export const diffNpmrdsConflationBlackboardDatabaseSnapshots = {
  command: 'npmrds_create_conflation_blackboard_database_snapshots_diff',
  desc: 'Create a diff database of two NPMRDS Conflation Blackboard snapshots.',
  builder: {
    a_timestamp: {
      ...existingTimestampBuilderElem,
      choices:
        existingBlkbrdSnapshotTimestampsByTargetMap?.npmrds?.slice(1) || [],
    },
    b_timestamp: {
      ...existingTimestampBuilderElem,
      choices:
        existingBlkbrdSnapshotTimestampsByTargetMap?.npmrds?.slice(0, -1) || [],
    },
  },
  handler: ({ a_timestamp, b_timestamp }) =>
    createBlkbrdDatabaseSnapshotsDiff('npmrds', [a_timestamp, b_timestamp]),
};

export const diffConflationBlackboardDatabaseSnapshots = {
  command: 'create_conflation_blackboard_database_snapshots_diff',
  desc:
    'Create a diff database for each TargetMap with a conflation blackboard snapshot.',
  builder: {
    a_timestamp: {
      ...existingTimestampBuilderElem,
      choices:
        commonExistingBlkbrdSnapshotTimestamps.commonTimestamps?.slice(1) || [],
    },
    b_timestamp: {
      ...existingTimestampBuilderElem,
      choices:
        commonExistingBlkbrdSnapshotTimestamps.commonTimestamps?.slice(0, -1) ||
        [],
    },
  },
  handler: ({ a_timestamp, b_timestamp }) =>
    createBlkbrdDatabaseSnapshotsDiff('npmrds', [a_timestamp, b_timestamp]),
};

export const fullConflationBlackboardSnapshot = {
  command: 'full_conflation_blackboard_snapshot',
  desc:
    'Create snapshot and diff databases for NYS RIS and NPMRDS Conflation Blackboards.',
  builder: {
    target_maps: {
      type: 'array',
      descript: 'TargetMaps',
      demand: true,
      choices: targetMaps,
      default: targetMaps,
    },
    timestamp: timestampBuilderElem,
  },
  handler: ({ target_maps, timestamp = currentTimestamp }) => {
    target_maps.forEach((targetMap: string) => {
      const initial = conflationBlkbrdSnapshotsFsUtils.getInitialSnapshotTimestampForTargetMap(
        targetMap,
      );

      const penult = conflationBlkbrdSnapshotsFsUtils.getLatestSnapshotTimestampForTargetMap(
        targetMap,
      );

      createBlkbrdDatabaseSnapshot(targetMap, timestamp);

      if (initial) {
        // Differential diff db snapshot
        createBlkbrdDatabaseSnapshotsDiff(targetMap, [initial, timestamp]);
      }

      if (penult && initial !== penult) {
        // Incremental diff db snapshot
        createBlkbrdDatabaseSnapshotsDiff(targetMap, [penult, timestamp]);
      }
    });
  },
};

export const updateSymlinks = {
  command: 'update_conflation_blkbrd_symlinks',
  desc: 'update the snapshot and diff symlinks',
  handler: () => {
    conflationBlkbrdSnapshotsFsUtils.updateSnapshotSymlinks();
    conflationBlkbrdDiffsFsUtils.updateDiffSymlinks();
  },
};
