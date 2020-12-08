/* eslint-disable import/prefer-default-export */

import loadShstMatches from '../loaders/loadShstMatches';
import loadChosenShstMatches from '../loaders/loadChosenShstMatches';

export const shstMatchNysRis = {
  command: 'nys_ris_shst_match',
  desc: 'Run SharedStreets matching on NYS RIS network.',
  builder: {},
  handler: loadShstMatches,
};

export const shstChooseMatchesNysRis = {
  command: 'nys_ris_choose_shst_matches',
  desc: 'Choose optimal SharedStreets matches for NYS RIS road segments.',
  builder: {},
  handler: loadChosenShstMatches,
};
