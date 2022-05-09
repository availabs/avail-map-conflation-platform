/* eslint-disable import/prefer-default-export */

import handler from '../OsmMapLoader/loadOsmMap';

import osmInputDirectory from '../constants/osmInputDirectory';

import availableOsmVersions from '../constants/availableOsmVersions';

import shrinkwrapDatabase from './utils/shrinkwrapDatabase';

import runOsrmToolChain from './utils/runOsrmToolChain';

const command = 'load_osm';
const desc = `Load the OSM file into SQLite. The OSM PBF files MUST be in ${osmInputDirectory}.`;

const builder = {
  osm_version: {
    desc: `The OpenStreetMap version. Must be alphanumeric, possibly with dashes or underscores, such as "albany-county_new-york-200101". The choices listed below are populated using the *.osm.pbf files found in ${osmInputDirectory}.`,
    type: 'string',
    demand: true,
    default:
      availableOsmVersions.length === 1 ? availableOsmVersions[0] : undefined,
    choices: availableOsmVersions,
  },
};

export const loadOpenStreetMapsPbfFile = {
  command,
  desc,
  builder,
  handler,
};

export const shrinkwrapOsmDatabase = {
  command: 'shrinkwrap_osm_database',
  desc: 'Make the OSM database Read-Only',
  handler: shrinkwrapDatabase,
};

export const osrmToolChain = {
  command: 'run_osrm_tool_chain',
  desc: 'Run the OSRM tool chain',
  handler: runOsrmToolChain,
};
