/* eslint-disable global-require */
import loadMicroLevel from '../loaders/loadMicroLevel';

import loadMesoLevel from '../loaders/loadMesoLevel';

// eslint-disable-next-line import/prefer-default-export
export const loadNysRisMicroLevel = {
  command: 'load_nys_ris_target_map_microlevel',
  desc: 'Load the NYS RIS Target Map Nodes and Edges Tables.',
  builder: {},
  handler: loadMicroLevel,
};

export const loadNysRisMesoLevel = {
  command: 'load_nys_ris_target_map_mesolevel',
  desc:
    'Load the NYS RIS Target Map Meso-Level Paths (Cross-County Network Traversals).',
  builder: {},
  handler: loadMesoLevel,
};
