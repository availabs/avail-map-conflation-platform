/* eslint-disable import/prefer-default-export */

import loadShstMatches from '../loaders/loadShstMatches';

const command = 'shst_match_npmrds_network';
const desc = 'Run SharedStreets matching on NPMRDS Road Network.';

const builder = {};

export const shstMatchNpmrds = {
  command,
  desc,
  builder,
  handler: loadShstMatches,
};
