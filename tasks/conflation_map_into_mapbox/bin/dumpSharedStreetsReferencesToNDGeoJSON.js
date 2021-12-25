#!/usr/bin/env node

/* eslint-disable no-restricted-syntax */

/*
  // https://github.com/sharedstreets/sharedstreets-types/blob/master/index.ts
  export enum RoadClass {
    Motorway = 0,
    Trunk = 1,
    Primary = 2,
    Secondary = 3,
    Tertiary = 4,
    Residential = 5,
    Unclassified = 6,
    Service = 7,
    Other = 8,
  }
*/

const { createWriteStream } = require('fs');
const { join } = require('path');

const yargs = require('yargs');

require('ts-node').register();

const { default: db } = require('../../../src/services/DbService');

const SourceMapDao = require('../../../src/daos/SourceMapDao');

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

const outputStream = createWriteStream(
  join(__dirname, '../derived_data/shst_references.ndjson'),
);

const iter = SourceMapDao.makeSharedStreetsReferenceFeaturesIterator();

let id = 0;
for (const shstRef of iter) {
  const {
    properties: { shstReferenceId, roadClass },
  } = shstRef;

  shstRef.id = id++;

  const properties = {
    s: shstReferenceId,
    n: roadClass ?? 6,
  };

  shstRef.properties = properties;

  outputStream.write(`${JSON.stringify(shstRef)}\n`);
}
