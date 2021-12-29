/* eslint-disable import/prefer-default-export */

import handler from '.';

import bulkLoadGtfsFeeds from './BulkLoader';
import consolidateConflationMapBusAadtTables from './Consolidator';

const command = 'load_raw_gtfs';
const desc = "Load an agency's GTFS feed into a SQLite Database.";

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

export const loadScrapedGtfsFeeds = {
  command: 'bulk_load_gtfs_feeds',
  desc:
    'Bulk load the set of GTFS feeds in the AVAIL_MAP_CONFLATION_INPUT_DIR.',
  handler: bulkLoadGtfsFeeds,
};

export const consolidateGtfsFeeds = {
  command: 'consolidate_gtfs_feeds_conflation',
  desc:
    'Consolidate the conflation map scheduled bus AADTs for all loaded GTFS feeds.',
  handler: consolidateConflationMapBusAadtTables,
};
