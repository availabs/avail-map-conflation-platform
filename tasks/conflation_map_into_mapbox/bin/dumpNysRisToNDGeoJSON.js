#!/usr/bin/env node

/* eslint-disable no-restricted-syntax */

const { createWriteStream } = require('fs');
const { join } = require('path');

const yargs = require('yargs');

require('ts-node').register();

const {
  default: TargetMapDAO,
} = require('../../../src/utils/TargetMapDatabases/TargetMapDAO');

const SCHEMA = 'nys_ris';

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
  join(__dirname, '../derived_data/nys_ris_2019.ndjson'),
);

const iter = targetMapDao.makeRawEdgeFeaturesIterator();

for (const nysRisFeature of iter) {
  const {
    properties: { functional_class = 8, fid },
  } = nysRisFeature;

  const f_system = functional_class % 10;

  nysRisFeature.id = fid;
  nysRisFeature.properties = { f_system, fid };

  outputStream.write(`${JSON.stringify(nysRisFeature)}\n`);
}
