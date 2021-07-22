/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'load_raw_gtfs';
const desc = 'Load the GTFS files into a SQLite Database.';

const builder = {
  agency_name: {
    desc: 'Transit agency name',
    type: 'string',
    demand: true,
  },
  gtfs_zip: {
    desc: 'Path to the GTFS zip archive.',
    type: 'string',
    demand: true,
  },
};

export const loadRawGtfs = {
  command,
  desc,
  builder,
  handler,
};
