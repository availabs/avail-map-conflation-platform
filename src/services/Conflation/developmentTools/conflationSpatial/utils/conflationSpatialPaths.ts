import { join } from 'path';

import outputDirectory from '../../../../../constants/outputDirectory';

import conflationDevelopmentDataDir from '../../constants/conflationDevelopmentDataDir';

export const outputSqliteDir = join(outputDirectory, 'sqlite');

const conflationSpatialParentDir = join(
  conflationDevelopmentDataDir,
  'conflation_spatial',
);

export const conflationSpatialInputMapsDir = join(
  conflationSpatialParentDir,
  'input_maps',
);

export const conflationSpatialBlkbrdSnapshotsDir = join(
  conflationSpatialParentDir,
  'conflation_blackboard_snapshots',
);

export const conflationSpatialSnapshotDiffDir = join(
  conflationSpatialParentDir,
  'conflation_snapshot_diffs',
);

export const conflationInputMapsGpkgPath = join(
  conflationSpatialInputMapsDir,
  'conflation_input_maps.gpkg',
);

export function getConflationBlkbrdSnapshotGpkgPath(
  targetMap: string,
  timestamp: string,
) {
  return join(
    conflationSpatialBlkbrdSnapshotsDir,
    `${targetMap}_conflation_blackboard_${timestamp}.gpkg`,
  );
}

export function getConflationSnapshotDiffGpkgPath(
  targetMap: string,
  a_timestamp: string,
  b_timestamp: string,
) {
  return join(
    conflationSpatialSnapshotDiffDir,
    `${targetMap}_conflation_blackboards_${a_timestamp}-${b_timestamp}_diff.gpkg`,
  );
}
