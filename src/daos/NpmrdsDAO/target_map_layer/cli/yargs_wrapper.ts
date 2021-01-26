/* eslint-disable global-require */
import loadTargetMap from '../loaders/loadTargetMap';

// eslint-disable-next-line import/prefer-default-export
export const loadNpmrdsTargetMap = {
  command: 'load_npmrds_target_map',
  desc: 'Load the NPMRDS Target Map Nodes, Edges and Paths Tables.',
  builder: {},
  handler: loadTargetMap,
};
