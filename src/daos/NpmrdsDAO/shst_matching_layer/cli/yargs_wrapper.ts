/* eslint-disable import/prefer-default-export */

import loadShstMatches from '../loaders/loadShstMatches';
import loadChosenShstMatches from '../loaders/loadChosenShstMatches';

export const shstMatchNpmrds = {
  command: 'npmrds_shst_match',
  desc: 'Run SharedStreets matching on NPMRDS road network.',
  builder: {},
  handler: loadShstMatches,
};

export const shstChooseMatchesNpmrds = {
  command: 'npmrds_choose_shst_matches',
  desc: 'Choose optimal SharedStreets matches for NPMRDS road Network edges.',
  builder: {},
  handler: loadChosenShstMatches,
};
