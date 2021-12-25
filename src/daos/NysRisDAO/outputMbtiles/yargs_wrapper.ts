/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'output_nys_ris_mbtiles';
const desc = 'Output the NYS Road Inventory System as MBTiles.';

const builder = {
  county: {
    desc: 'The county name',
    type: 'string',
    demand: false,
  },
};

export const outputNysRisMBTiles = {
  command,
  desc,
  builder,
  handler,
};
