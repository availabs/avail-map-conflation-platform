/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'load_nys_ris';
const desc = 'Load the NYS Road Inventory System Geodatabase.';

const builder = {
  nys_ris_geodatabase_tgz: {
    desc:
      'Path to the gzipped tar archive of the NYS Road Inventory System Geodatabase.',
    type: 'string',
    demand: true,
  },
  year: {
    desc: 'Map year.',
    type: 'number',
    demand: true,
  },
  county: {
    desc: 'For development purposes, only load a specific county.',
    type: 'string',
    demand: false,
  },
};

export const loadRawNysRisTables = {
  command,
  desc,
  builder,
  handler,
};
