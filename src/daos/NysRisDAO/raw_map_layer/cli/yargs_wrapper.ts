/* eslint-disable import/prefer-default-export */

import handler from '.';

import availableNysRisVersions from '../constants/availableNysRisVersions';

const command = 'load_nys_ris';
const desc =
  'Load the NYS Road Inventory System Geodatabase. NOTE: FileGDB is expected be the standardized format output by the https://github.com/availabs/avail-gis-toolkit/tree/main/src/NysRisDao createFileGdb method.';

const builder = {
  nys_ris_version: {
    desc: 'The NYS Road Inventory System Version.',
    type: 'string',
    demand: true,
    default:
      availableNysRisVersions.length === 1
        ? availableNysRisVersions[0]
        : undefined,
    choices: availableNysRisVersions,
  },
};

export const loadRawNysRisTables = {
  command,
  desc,
  builder,
  handler,
};
