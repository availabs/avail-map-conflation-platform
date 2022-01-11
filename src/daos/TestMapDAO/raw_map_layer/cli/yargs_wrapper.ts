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
  // pt_aggitation_meters: {
  // desc: 'aggitate the map points by random() * pt_aggitation_meters',
  // type: 'number',
  // demand: false,
  // default: 0,
  // },
  // line_offset_meters: {
  // desc: 'offset the map lines by random() * line_offset_meters',
  // type: 'number',
  // demand: false,
  // default: 0,
  // },
};

export const loadTestMap = {
  command,
  desc,
  builder,
  handler,
};
