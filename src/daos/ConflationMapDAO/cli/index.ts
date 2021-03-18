/* eslint-disable global-require */
import ConflationMapDAO from '..';

export const initializeConflationMapDatabase = {
  command: 'initialize_conflation_map_database',
  desc: 'Initialize the Conflation Map Database',
  builder: {},
  handler: () => new ConflationMapDAO(),
};

export const outputConflationMapMBTiles = {
  command: 'output_conflation_map_mbtiles',
  desc: 'Output the Conflation Map MBTiles',
  builder: {},
  handler: () => new ConflationMapDAO().createMBTiles(),
};
