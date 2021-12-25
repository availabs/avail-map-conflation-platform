#!/usr/bin/env node

/* eslint-disable no-restricted-syntax */

const { join } = require('path');
const yargs = require('yargs');

require('ts-node').register();

const {
  default: dumpVicinityShapefile,
} = require('../utils/dumpVicinityShapefile');

const defaultVicinityShpfileDir = join(
  __dirname,
  '../../../..//tmpath_vicinity_shpfiles/',
);

const cliArgsSpec = {
  vicinity_shpfiles_dir: {
    demand: false,
    type: 'string',
    desc: 'Path to the vicinity shapefiles directory',
    default: defaultVicinityShpfileDir,
  },

  target_map: {
    demand: true,
    type: 'string',
    desc: 'TargetMap',
    choices: ['npmrds', 'nys_ris'],
  },

  target_map_path_id: {
    demand: true,
    type: 'number',
    desc: 'TargetMapPathId',
  },
};

const {
  argv: { vicinity_shpfiles_dir, target_map, target_map_path_id },
} = yargs
  .strict()
  .parserConfiguration({
    'camel-case-expansion': false,
    'flatten-duplicate-arrays': false,
  })
  .wrap(yargs.terminalWidth() / 1.618)
  .option(cliArgsSpec);

const shpfileDir = join(vicinity_shpfiles_dir, target_map);

dumpVicinityShapefile({
  targetMap: target_map,
  targetMapPathId: target_map_path_id,
  shpfileDir,
});
