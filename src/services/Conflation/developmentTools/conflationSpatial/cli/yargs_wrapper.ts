/* eslint-disable import/prefer-default-export */

import {
  createDevConflationInputMapsGpkg,
  createConflationBlkbrdSnapshotGpkg,
  createConflationSnapshotDiffGpkg,
} from '..';

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

export const devConflationBlkbrdSnapshotGpkg = {
  command: 'create_conflation_blackboard_snapshot_gpkg',
  desc:
    'Create a GeoPackage with a layer for each conflation input map (Shst, NysRis, NPMRDS).',
  builder: {
    target_map: {
      type: 'string',
      describe: 'Create a GeoPackage for the conflation blackboard snapshot.',
      demand: true,
    },
    timestamp: {
      type: 'string',
      describe: 'timestamp',
      demand: true,
    },
  },
  handler: ({ target_map, timestamp }) =>
    createConflationBlkbrdSnapshotGpkg(target_map, timestamp),
};

export const devConflationSnapshotDiffGpkg = {
  command: 'create_conflation_blackboard_snapshots_diff_gpkg',
  desc:
    'Create a GeoPackage with a layer for each conflation input map (Shst, NysRis, NPMRDS).',
  builder: {
    target_map: {
      type: 'string',
      describe: 'Create a GeoPackage for the conflation blackboard snapshot.',
      demand: true,
    },
    a_timestamp: {
      type: 'string',
      describe: 'timestamp',
      demand: true,
    },
    b_timestamp: {
      type: 'string',
      describe: 'timestamp',
      demand: true,
    },
  },
  handler: ({ target_map, a_timestamp, b_timestamp }) =>
    createConflationSnapshotDiffGpkg(target_map, a_timestamp, b_timestamp),
};
