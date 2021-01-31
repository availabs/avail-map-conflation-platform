#!/usr/bin/env node

/* eslint-disable no-restricted-syntax, no-await-in-loop */

const { createWriteStream } = require('fs');
const { join } = require('path');

const yargs = require('yargs');
const _ = require('lodash');

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
  join(__dirname, '../derived_data/shst_intersections.ndjson'),
);

let id = 0;

const minzooms = _.range(0, 9).map((i) =>
  i <= 3 ? 7 + i : Math.min(8 + i, 15),
);

(async () => {
  const iter = SourceMapDao.makeShstIntersectionsWithMinRoadClassIter();

  for (const shstIntxn of iter) {
    const {
      id: shstIntersectionId,
      properties: { roadClass },
    } = shstIntxn;

    const n = roadClass ? roadClass - 1 : 6;
    shstIntxn.id = ++id;

    shstIntxn.properties = { id, si: shstIntersectionId, n };

    shstIntxn.tippecanoe = { minzoom: minzooms[n] };

    // https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback
    if (!outputStream.write(`${JSON.stringify(shstIntxn)}\n`)) {
      await new Promise((resolve) => outputStream.once('drain', resolve));
    }
  }
})();
