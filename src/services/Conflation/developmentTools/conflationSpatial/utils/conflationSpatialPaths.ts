import { join } from 'path';

import outputDirectory from '../../../../../constants/outputDirectory';

import conflationDevelopmentDataDir from '../../constants/conflationDevelopmentDataDir';

import SnapshotsByTargetMapFsUtils from '../../utils/SnapshotsByTargetMapFsUtils';
import DiffsByTargetMapFsUtils from '../../utils/DiffsByTargetMapFsUtils';

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

export const conflationBlkbrdSnapshotsGpkgFsUtils = new SnapshotsByTargetMapFsUtils(
  {
    dir: conflationSpatialBlkbrdSnapshotsDir,
    nameCore: 'conflation_blackboard_snapshot',
    ext: 'gpkg',
    autoUpdateSymlinks: true,
  },
);

export const conflationBlkbrdDiffsGpkgFsUtils = new DiffsByTargetMapFsUtils({
  dir: conflationSpatialSnapshotDiffDir,
  nameCore: 'conflation_blackboard_diff',
  ext: 'gpkg',
  autoUpdateSymlinks: true,
});
