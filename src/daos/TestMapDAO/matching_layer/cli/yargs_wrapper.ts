/* eslint-disable import/prefer-default-export */

import loadMatches from '../loaders/loadMatches';

export const loadTestMapMatches = {
  command: 'load_test_map_matches',
  desc: 'Run the TestMap throught the matching process.',
  builder: {},
  handler: loadMatches,
};
