/* eslint-disable global-require */
import loadMicroLevel from '../loaders/loadMicroLevel';

import loadMesoLevel from '../loaders/loadMesoLevel';

// eslint-disable-next-line import/prefer-default-export
export const loadNpmrdsMicroLevel = {
  command: 'load_npmrds_target_map_microlevel',
  desc: 'Load the NPMRDS Target Map Nodes and Edges Tables.',
  builder: {},
  handler: loadMicroLevel,
};

export const loadNpmrdsMesoLevel = {
  command: 'load_npmrds_target_map_mesolevel',
  desc:
    'Load the NPMRDS Target Map Meso-Level Paths (Cross-County Network Traversals).',
  builder: {},
  handler: loadMesoLevel,
};
