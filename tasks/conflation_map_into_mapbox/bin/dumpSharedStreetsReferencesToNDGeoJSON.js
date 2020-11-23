#!/usr/bin/env node

/* eslint-disable no-restricted-syntax */

/*
  CREATE TABLE __SCHEMA__.shst_reference_forms_of_way
    AS
      SELECT
          column1 AS element,
          column2 as value
        FROM (
          VALUES
            ('Undefined',            0),
            ('Motorway',             1),
            ('MultipleCarriageway',  2),
            ('SingleCarriageway',    3),
            ('Roundabout',           4),
            ('TrafficSquare',        5),
            ('SlipRoad',             6),
            ('Other',                7)
        )
  ;
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
    properties: { shstReferenceId, formOfWay },
  } = shstRef;

  shstRef.id = id++;

  const properties = {
    s: shstReferenceId,
    n: formOfWay ? formOfWay - 1 : 6,
  };

  shstRef.properties = properties;

  outputStream.write(`${JSON.stringify(shstRef)}\n`);
}
