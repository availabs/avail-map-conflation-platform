import handler from '.';

const command = 'load_source_map';
const desc = 'Load the OSM and SharedStreets maps into a SQLite Database.';

const builder = {
  osm_xml: {
    desc: 'Path to the OpenStreetMap XML file.',
    type: 'string',
    demand: true,
  },
  shst_tile_cache_dir: {
    desc:
      'Path to the SharedStreets tileset cache dir. This location is used during the conflation stage, also.',
    type: 'string',
    demand: true,
  },
  shst_tile_source: {
    desc:
      'SharedStreets tile source, which is derived from OSM. For example, 200910.',
    type: 'string',
    demand: true,
  },
};

module.exports = {
  command,
  desc,
  builder,
  handler,
};
