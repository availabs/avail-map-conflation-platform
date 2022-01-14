/* eslint-disable import/prefer-default-export */

import loadQualityAssuranceLayer from '../loaders/loadQualityAssuranceLayer';

export const loadTestMapQualityAssuranceLayer = {
  command: 'load_test_map_qa_tables',
  desc: 'Load the TestMap conflation QA tables.',
  builder: {},
  handler: loadQualityAssuranceLayer,
};
