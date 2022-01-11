import loadTargetMap from '../loaders/loadTargetMap';

// eslint-disable-next-line import/prefer-default-export
export const loadTestTargetMap = {
  command: 'load_test_target_map',
  desc: 'Load the Test Target Map Nodes, Edges and Paths Tables.',
  builder: {},
  handler: loadTargetMap,
};
