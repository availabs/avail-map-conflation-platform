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

export const conflationInputMapsGpkgPath = join(
  conflationSpatialInputMapsDir,
  'conflation_input_maps.gpkg',
);
