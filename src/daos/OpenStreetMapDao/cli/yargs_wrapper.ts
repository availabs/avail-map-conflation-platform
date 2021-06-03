/* eslint-disable import/prefer-default-export */

import { existsSync, readdirSync } from 'fs';

import handler from '.';

import osmInputDirectory from '../constants/osmInputDirectory';

import getOsmVersionFromPbfFileName from '../utils/getOsmVersionFromPbfFileName';

const validOsmVersions = existsSync(osmInputDirectory)
  ? readdirSync(osmInputDirectory)
      .map(getOsmVersionFromPbfFileName)
      .filter((v) => v)
  : [];

const command = 'load_osm';
const desc = `Load the OSM file into SQLite. The OSM PBF files MUST be in ${osmInputDirectory}.`;

const builder = {
  osm_version: {
    desc: `The OpenStreetMap version. Must be alphanumeric, possibly with dashes or underscores, such as "albany-county_new-york-200101". The choices listed below are populated using the *.osm.pbf files found in ${osmInputDirectory}.`,
    type: 'string',
    demand: true,
    default: validOsmVersions.length === 1 ? validOsmVersions[0] : undefined,
    choices: validOsmVersions,
  },
};

export const loadOpenStreetMapsPbfFile = {
  command,
  desc,
  builder,
  handler,
};

// export const shrinkwrapSourceMapDatabase = {
// command: 'shrinkwrap_source_map_database',
// desc: 'Make the SourceMap database Read-Only',
// handler: shrinkwrapDatabase,
// };
