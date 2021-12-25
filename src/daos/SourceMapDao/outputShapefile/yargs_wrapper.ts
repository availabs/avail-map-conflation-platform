/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'output_source_map_shapefile';
const desc = 'Output the SharedSteets references Geodatabase.';

const builder = {
  shapefile_path: {
    desc:
      'Path to the output shapefile directory. Warning: If this directory exists, it will be deleted.',
    type: 'string',
    demand: true,
  },
};

export const outputSourceMapShapefile = {
  command,
  desc,
  builder,
  handler,
};
