#!/usr/bin/env node

/* eslint-disable no-restricted-syntax */

const yargs = require('yargs');

require('ts-node').register();

const {
  default: dumpSerializedVicinity,
} = require('../utils/dumpSerializedVicinity');

const cliArgsSpec = {
  out_file_path: {
    demand: true,
    type: 'string',
    desc: 'Path to the vicinity JSON output file',
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
  argv: { out_file_path, target_map, target_map_path_id },
} = yargs
  .strict()
  .parserConfiguration({
    'camel-case-expansion': false,
    'flatten-duplicate-arrays': false,
  })
  .wrap(yargs.terminalWidth() / 1.618)
  .option(cliArgsSpec);

dumpSerializedVicinity({
  targetMap: target_map,
  targetMapPathId: target_map_path_id,
  outFilePath: out_file_path,
});
