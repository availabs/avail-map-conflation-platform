/* eslint-disable import/prefer-default-export */

import { existsSync, readdirSync } from 'fs';

import handler from '.';

import OpenStreetMapDao from '..';

// import shrinkwrapDatabase from './utils/shrinkwrapDatabase';

const validOsmVersions = existsSync(OpenStreetMapDao.osmXmlInputDirectory)
  ? readdirSync(OpenStreetMapDao.osmXmlInputDirectory)
      .filter((f) => /osm\.gz$/.test(f))
      .map(OpenStreetMapDao.getOsmVersionFromXmlGzFileName)
      .filter((v) => v)
  : [];

const command = 'load_osm';
const desc = `
  Load the OSM file into SQLite.
  The OSM XML files are expected to be named <osm_version>.osm.gz,
    and found in ${OpenStreetMapDao.osmXmlInputDirectory}.
`;

const builder = {
  osm_version: {
    desc: `The OpenStreetMap version. Must be alphanumeric, possibly with dashes, such as "new-york-2100101". The choices listed below are populated using the *.osm.gz files found in ${OpenStreetMapDao.osmXmlInputDirectory}.`,
    type: 'string',
    demand: true,
    choices: validOsmVersions,
  },
};

export const loadOpenStreetMapsXmlFile = {
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
