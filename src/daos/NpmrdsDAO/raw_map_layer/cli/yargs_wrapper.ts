/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'load_raw_npmrds';
const desc = 'Load the NPMRDS shapefile and TMC_Identification files.';

const builder = {
  npmrds_tmc_identification_gz: {
    desc: 'Path to the gzipped TMC_Identification file',
    type: 'string',
    demand: true,
  },
  npmrds_shapefile_tgz: {
    desc: 'Path to the gzipped tar archive of the NPMRDS shapefile.',
    type: 'string',
    demand: true,
  },
};

export const loadRawNpmrdsTables = {
  command,
  desc,
  builder,
  handler,
};
