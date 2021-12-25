#!/usr/bin/env node

/* eslint-disable no-restricted-syntax, no-await-in-loop */

const { createWriteStream } = require('fs');
const { join } = require('path');

const yargs = require('yargs');

const turf = require('@turf/turf');
const _ = require('lodash');

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
  join(__dirname, '../derived_data/nys_ris_2019_endpoints.ndjson'),
);

(async () => {
  const iter = targetMapDao.makeRawEdgeFeaturesIterator();

  for (const nysRisFeature of iter) {
    const {
      properties: { functional_class = 8, fid: id },
    } = nysRisFeature;

    const f_system = functional_class % 10;

    const coords = _(turf.getCoords(nysRisFeature))
      .flattenDeep()
      .chunk(2)
      .value();

    const fromPt = turf.point(coords[0], {
      id,
      f_system,
      where: 'start',
    });

    const toPt = turf.point(coords[coords.length - 1], {
      id,
      f_system,
      where: 'end',
    });

    // https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback
    let good = outputStream.write(`${JSON.stringify(fromPt)}\n`);
    good = outputStream.write(`${JSON.stringify(toPt)}\n`) && good;

    if (!good) {
      // console.log('Awaiting drain');
      await new Promise((resolve) => outputStream.once('drain', resolve));
      // console.log('drained');
    }
  }
})();
