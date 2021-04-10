/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'output_npmrds_qa_mbtiles';
const desc = 'Output the NPMRDS Features for QA MBTiles.';

const builder = {
  county: {
    desc: 'The county name',
    type: 'string',
    demand: false,
  },
};

export const outputNpmrdsMBTilesForQA = {
  command,
  desc,
  builder,
  handler,
};
