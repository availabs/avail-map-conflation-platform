/* eslint-disable import/prefer-default-export */

import loadShstMatches from '../loaders/loadShstMatches';

export const shstMatchNpmrds = {
  command: 'npmrds_shst_match',
  desc: 'Run SharedStreets matching on NPMRDS road network.',
  builder: {},
  handler: loadShstMatches,
};
