/* eslint-disable global-require */
import handler from '.';

const command = 'load_nys_ris';
const desc = 'Load the NYS Road Inventory System Geodatabase.';

const builder = {
  nys_ris_geodatabase_tgz: {
    desc:
      'Path to the gzipped tar archive of the NYS Road Inventory System Geodatabase.',
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
