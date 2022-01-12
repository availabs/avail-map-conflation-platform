/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'load_test_map';

const desc = 'Create and load the test map.';

const builder = {
  // centerline: {
  // desc: 'create a centerline test map',
  // type: 'boolean',
  // demand: false,
  // default: false,
  // },
  subnet_polygon_geojson: {
    desc: 'Path to an optional GeoJSON file containing the subnet polygon',
    type: 'string',
    demand: false,
    default: null,
  },
};

export const loadTestMap = {
  command,
  desc,
  builder,
  handler,
};
