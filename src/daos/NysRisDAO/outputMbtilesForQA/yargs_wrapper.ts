/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'output_nys_ris_qa_mbtiles';
const desc = 'Output the NYS Road Inventory System QA MBTiles.';

const builder = {
  county: {
    desc: 'The county name',
    type: 'string',
    demand: false,
  },
};

export const outputNysRisMBTilesForQA = {
  command,
  desc,
  builder,
  handler,
};
