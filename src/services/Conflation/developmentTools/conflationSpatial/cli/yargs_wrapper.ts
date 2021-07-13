/* eslint-disable import/prefer-default-export */

import _ from 'lodash';

import {
  createDevConflationInputMapsGpkg,
  createConflationBlkbrdSnapshotGpkg,
  createConflationSnapshotDiffGpkg,
} from '..';

import {
  conflationBlkbrdSnapshotsFsUtils,
  conflationBlkbrdDiffsFsUtils,
} from '../../conflationDatabases/utils/conflationBlkbrdDbPaths';

import {
  conflationBlkbrdSnapshotsGpkgFsUtils,
  conflationBlkbrdDiffsGpkgFsUtils,
} from '../utils/conflationSpatialPaths';

const existingBlkbrdSnapshotTimestampsByTargetMap =
  conflationBlkbrdSnapshotsFsUtils.existingSnapshotTimestampsByTargetMap;

const commonExistingBlkbrdSnapshotTimestamps =
  conflationBlkbrdSnapshotsFsUtils.commonExistingTimestamps;

const existingBlkbrdDiffTimestampsByTargetMap =
  conflationBlkbrdDiffsFsUtils.existingDiffTimestampsByTargetMap;

const commonExistingBlkbrdDiffTimestamps =
  conflationBlkbrdDiffsFsUtils.commonExistingTimestamps;

export const devConflationInputMapsGpkg = {
  command: 'create_all_input_maps_gpkg',
  desc:
    'Create a GeoPackage with a layer for each conflation input map (Shst, NysRis, NPMRDS).',
  builder: {
    overwrite: {
      type: 'boolean',
      describe: 'Overwrite GeoPackage if it already exists.',
      default: false,
    },
  },
  handler: ({ overwrite }) => createDevConflationInputMapsGpkg(overwrite),
};

export const nysRisConflationBlkbrdSnapshotGpkg = {
  command: 'nys_ris_create_conflation_blackboard_snapshot_gpkg',
  desc:
    'Create a GeoPackage using a NYS RIS conflation blackboard snapshot with the following layers: shst_matches, chosen_matches, assigned_matches',
  builder: {
    timestamp: {
      type: 'string',
      describe: 'timestamp',
      demand: true,
      choices: existingBlkbrdSnapshotTimestampsByTargetMap.nys_ris ?? [],
      default: _.last(
        existingBlkbrdSnapshotTimestampsByTargetMap.nys_ris ?? [],
      ),
    },
  },
  handler: ({ timestamp }) =>
    createConflationBlkbrdSnapshotGpkg('nys_ris', timestamp),
};

export const npmrdsConflationBlkbrdSnapshotGpkg = {
  command: 'npmrds_create_conflation_blackboard_snapshot_gpkg',
  desc:
    'Create a GeoPackage using a NPMRDS conflation blackboard snapshot with the following layers: shst_matches, chosen_matches, assigned_matches',
  builder: {
    timestamp: {
      type: 'string',
      describe: 'timestamp',
      demand: true,
      choices: existingBlkbrdSnapshotTimestampsByTargetMap.npmrds ?? [],
      default: _.last(existingBlkbrdSnapshotTimestampsByTargetMap.npmrds ?? []),
    },
  },
  handler: ({ timestamp }) =>
    createConflationBlkbrdSnapshotGpkg('npmrds', timestamp),
};

export const conflationBlkbrdSnapshotGpkg = {
  command: 'create_conflation_blackboard_snapshot_gpkgs',
  desc:
    'Create a GeoPackage for each TargetMap conflation using a blackboard snapshot with the following layers: shst_matches, chosen_matches, assigned_matches',
  builder: {
    timestamp: {
      type: 'string',
      describe:
        'timestamp (MUST be common across all target maps with conflation blackboard snapshots)',
      demand: true,
      choices: commonExistingBlkbrdSnapshotTimestamps.commonTimestamps || [],
      default: _.last(commonExistingBlkbrdSnapshotTimestamps.commonTimestamps),
    },
  },
  handler: ({ timestamp }) =>
    commonExistingBlkbrdSnapshotTimestamps.targetMaps.forEach((targetMap) =>
      createConflationBlkbrdSnapshotGpkg(targetMap, timestamp),
    ),
};

export const nysRisDevConflationSnapshotDiffGpkg = {
  command: 'nys_ris_create_conflation_blackboard_snapshots_diff_gpkg',
  desc:
    'Create a GeoPackage with a layer for each conflation input map (Shst, NysRis, NPMRDS).',
  builder: {
    timestamps: {
      type: 'array',
      describe: 'timestamps of the diff',
      demand: true,
      choices: existingBlkbrdDiffTimestampsByTargetMap.nys_ris,
      default: _.last(existingBlkbrdDiffTimestampsByTargetMap.nys_ris),
    },
  },
  handler: ({ timestamps }) => {
    const tstamps = timestamps.map((ts: number) => `${ts}`);
    createConflationSnapshotDiffGpkg('nys_ris', tstamps);
  },
};

export const npmrdsDevConflationSnapshotDiffGpkg = {
  command: 'npmrds_create_conflation_blackboard_snapshots_diff_gpkg',
  desc:
    'Create a GeoPackage with a layer for each conflation input map (Shst, NysRis, NPMRDS).',
  builder: {
    timestamps: {
      type: 'array',
      describe: 'timestamps of the diff',
      demand: true,
      choices: existingBlkbrdDiffTimestampsByTargetMap.npmrds,
      default: _.last(existingBlkbrdDiffTimestampsByTargetMap.npmrds),
    },
  },
  handler: ({ timestamps }) => {
    const tstamps = timestamps.map((ts: number) => `${ts}`);
    createConflationSnapshotDiffGpkg('npmrds', tstamps);
  },
};

export const devConflationSnapshotDiffGpkg = {
  command: 'create_conflation_blackboard_snapshots_diff_gpkg',
  desc:
    'Create a GeoPackage with a layer for each conflation input map (Shst, NysRis, NPMRDS).',
  builder: {
    timestamps: {
      type: 'array',
      describe: 'timestamps of the diff',
      demand: true,
      choices: existingBlkbrdDiffTimestampsByTargetMap.nys_ris,
      default: _.last(commonExistingBlkbrdSnapshotTimestamps.commonTimestamps),
    },
  },
  handler: ({ timestamps }) => {
    const tstamps = timestamps.map((ts: number) => `${ts}`);

    commonExistingBlkbrdDiffTimestamps.targetMaps.forEach((targetMap) =>
      createConflationSnapshotDiffGpkg(targetMap, tstamps),
    );
  },
};

export const create_latest_gpkgs = {
  command: 'create_latest_gpkgs',
  desc:
    'Update the snapshots and diffs for each target_map with snapshots and diffs',
  handler: () => {
    createDevConflationInputMapsGpkg(false);

    Object.keys(existingBlkbrdSnapshotTimestampsByTargetMap).forEach(
      (targetMap) => {
        const latest = _.last(
          existingBlkbrdSnapshotTimestampsByTargetMap[targetMap],
        );
        // @ts-ignore
        createConflationBlkbrdSnapshotGpkg(targetMap, latest);
      },
    );

    Object.keys(existingBlkbrdDiffTimestampsByTargetMap).forEach(
      (targetMap) => {
        const latest = _.last(
          existingBlkbrdDiffTimestampsByTargetMap[targetMap],
        );

        console.log();
        console.log();
        console.log(JSON.stringify({ latest }, null, 4));
        console.log();
        console.log();

        // @ts-ignore
        createConflationSnapshotDiffGpkg(targetMap, latest);
      },
    );
  },
};

export const updateSymlinks = {
  command: 'update_conflation_gpkg_symlinks',
  desc: 'update the snapshot and diff symlinks',
  handler: () => {
    conflationBlkbrdSnapshotsGpkgFsUtils.updateSnapshotSymlinks();
    conflationBlkbrdDiffsGpkgFsUtils.updateDiffSymlinks();
  },
};
