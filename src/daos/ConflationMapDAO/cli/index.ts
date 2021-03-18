/* eslint-disable global-require */
import ConflationMapDAO from '..';

// eslint-disable-next-line import/prefer-default-export
export const initializeConflationMapDatabase = {
  command: 'initialize_conflation_map_database',
  desc: 'Initialize the Conflation Map Database',
  builder: {},
  handler: () => new ConflationMapDAO(),
};
