/* eslint-disable global-require */
import loadTargetMap from '../loaders/loadTargetMap';

// eslint-disable-next-line import/prefer-default-export
export const loadNysRisTargetMap = {
  command: 'load_nys_ris_target_map',
  desc: 'Load the NYS RIS Target Map Nodes, Edges and Paths Tables.',
  builder: {},
  handler: loadTargetMap,
};
