import ConflationMapDAO from '..';

export const initializeConflationMapDatabase = {
  command: 'initialize_conflation_map_database',
  desc: 'Initialize the Conflation Map Database',
  builder: {},
  handler: () => new ConflationMapDAO().initialize(),
};

export const outputConflationMapMBTiles = {
  command: 'output_conflation_map_mbtiles',
  desc: 'Output the Conflation Map MBTiles',
  builder: {},
  handler: () => new ConflationMapDAO().createMBTiles(),
};

export const outputConflationShapefile = {
  command: 'output_conflation_map_shapefile',
  desc: 'Output the Conflation Shapefile',
  builder: {},
  handler: () => new ConflationMapDAO().outputShapefile(),
};

export const outputConflationMapMBTilesForQA = {
  command: 'output_conflation_map_qa_mbtiles',
  desc: 'Output the Conflation Map QA MBTiles',
  builder: {},
  handler: () => new ConflationMapDAO().createMBTilesForQA(),
};
