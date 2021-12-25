/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'output_npmrds_mbtiles';
const desc = 'Output the NPMRDS Features as MBTiles.';

const builder = {
  county: {
    desc: 'The county name',
    type: 'string',
    demand: false,
  },
};

export const outputNpmrdsMBTiles = {
  command,
  desc,
  builder,
  handler,
};
