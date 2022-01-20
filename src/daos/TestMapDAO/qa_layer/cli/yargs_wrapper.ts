/* eslint-disable import/prefer-default-export */

import loadQualityAssuranceLayer from '../loaders/loadQualityAssuranceLayer';
import dumpSpatiaLiteDb from '../loaders/dumpSpatiaLiteDb';

export const load = {
  command: 'load_test_map_qa_tables',
  desc: 'Load the TestMap conflation QA tables.',
  builder: {},
  handler: loadQualityAssuranceLayer,
};

export const dump = {
  command: 'dump_test_map_qa_spatialite_db',
  desc: 'Dump the TestMap conflation QA SpatiaLite DB.',
  builder: {},
  handler: dumpSpatiaLiteDb,
};
