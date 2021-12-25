/* eslint-disable import/prefer-default-export */

import handler from '.';

import availableTmcIdentificationVersions from './constants/availableTmcIdentificationVersions';
import availableNpmrdsShapefileVersions from './constants/availableNpmrdsShapefileVersions';

const command = 'load_npmrds';

const desc =
  'Load the NPMRDS shapefile and TMC_Identification files. NOTE: The NPMRDS Shapefile is expected be the standardized format output by the https://github.com/availabs/avail-gis-toolkit/tree/main/src/NpmrdsDao createShapefile method.';

const builder = {
  tmc_identification_version: {
    desc: 'The TMC_Identification file version',
    type: 'string',
    demand: true,
    default:
      availableTmcIdentificationVersions.length === 1
        ? availableTmcIdentificationVersions[0]
        : undefined,
    choices: availableTmcIdentificationVersions,
  },
  npmrds_shapefile_version: {
    desc: 'The NPMRDS Shapefilefile version',
    type: 'string',
    demand: true,
    default:
      availableNpmrdsShapefileVersions.length === 1
        ? availableNpmrdsShapefileVersions[0]
        : undefined,
    choices: availableNpmrdsShapefileVersions,
  },
};

export const loadRawNpmrdsTables = {
  command,
  desc,
  builder,
  handler,
};
