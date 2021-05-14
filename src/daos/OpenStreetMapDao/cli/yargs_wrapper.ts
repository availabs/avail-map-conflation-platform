/* eslint-disable import/prefer-default-export */

import handler from '.';

const command = 'load_osm';
const desc = 'Load the OSM XML file into SQLite.';

const builder = {
  osm_xml: {
    desc: 'Path to the OpenStreetMap XML file.',
    type: 'string',
    demand: true,
  },
};

export const loadOpenStreetMapsXmlFile = {
  command,
  desc,
  builder,
  handler,
};
