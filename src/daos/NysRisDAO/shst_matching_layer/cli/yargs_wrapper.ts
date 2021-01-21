/* eslint-disable import/prefer-default-export */

import loadShstMatches from '../loaders/loadShstMatches';

export const shstMatchNysRis = {
  command: 'nys_ris_shst_match',
  desc: 'Run SharedStreets matching on NYS RIS network.',
  builder: {},
  handler: loadShstMatches,
};
