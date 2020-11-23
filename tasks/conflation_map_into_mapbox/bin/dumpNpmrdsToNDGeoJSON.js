#!/usr/bin/env node

/* eslint-disable no-restricted-syntax */

const { createWriteStream } = require('fs');
const { join } = require('path');

const yargs = require('yargs');

require('ts-node').register();

const {
  default: TargetMapDAO,
} = require('../../../src/utils/TargetMapDatabases/TargetMapDAO');

const SCHEMA = 'NPMRDS';

const { default: db } = require('../../../src/services/DbService');

const defaultOutputDir = join(__dirname, '../../../output');

const cliArgsSpec = {
  output_dir: {
    demand: false,
    type: 'string',
    desc: 'Path to the output directory',
    default: defaultOutputDir,
  },
};

const {
  argv: { output_dir },
} = yargs
  .strict()
  .parserConfiguration({
    'camel-case-expansion': false,
    'flatten-duplicate-arrays': false,
  })
  .wrap(yargs.terminalWidth() / 1.618)
  .option(cliArgsSpec);

db.setOutputDirectory(output_dir);

const targetMapDao = new TargetMapDAO(null, SCHEMA);

const outputStream = createWriteStream(
  join(__dirname, '../derived_data/npmrds_2019.ndjson'),
);

const iter = targetMapDao.makeRawEdgeFeaturesIterator();

let id = 0;
for (const npmrdsFeature of iter) {
  const { f_system = 8, tmc } = npmrdsFeature;

  npmrdsFeature.id = id++;
  npmrdsFeature.properties = { f_system, tmc };

  outputStream.write(`${JSON.stringify(npmrdsFeature)}\n`);
}
