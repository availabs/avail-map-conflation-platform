/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'output_npmrds_shapefile';
const desc =
  'Output the raw NPMRDS shapefile and the SharedStreets matches as an ESRI Shapefile.';

const builder = {
  output_directory: {
    desc: 'Path to the output ESRI Shapefile directory',
    type: 'string',
    demand: true,
  },
  clean: {
    desc: 'If output_directory exists, delete it before re-creating it.',
    type: 'boolean',
    demand: false,
    default: false,
  },
};

export const outputNpmrdsShapefile = {
  command,
  desc,
  builder,
  handler,
};
