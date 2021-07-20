/* eslint-disable no-restricted-syntax, no-await-in-loop */

// For additional required MBTiles, see https://github.com/availabs/npmrds4/tree/master/tasks/npmrds-mbtiles

import { spawnSync } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import tmp from 'tmp';

import getTerseConflationMapSegment from './getTerseConflationMapSegment';

import { ConflationMapSegment } from '../domain/types';

import outputDirectory from '../../../constants/outputDirectory';

const tmpDir = join(outputDirectory, 'conflation_map/tmp');
mkdirSync(tmpDir, { recursive: true });

tmp.setGracefulCleanup();

const tippecanoeDetails = {
  0: { layer: 'major' },
  1: { minzoom: 5, layer: 'major' },
  2: { minzoom: 5, layer: 'major' },
  3: { minzoom: 5, layer: 'major' },
  4: { minzoom: 5, layer: 'major' },
  5: { minzoom: 11, layer: 'local' },
  6: { minzoom: 11, layer: 'local' },
  7: { minzoom: 11, layer: 'local' },
  8: { minzoom: 14, layer: 'paths' },
};

const mbtilesOutputFile = join(
  outputDirectory,
  'conflation_map',
  'conflation_map.mbtiles',
);

const outputSegmentsAsNDJSON = async (
  conflationMapSegmentIter: Generator<ConflationMapSegment>,
  tmpFilePath: string,
) => {
  console.log('outputSegmentsAsNDJSON');

  const writeStream = createWriteStream(join(tmpFilePath), {
    emitClose: true,
  });

  for (const conflationMapSegment of conflationMapSegmentIter) {
    const terseConflationMapSegment = getTerseConflationMapSegment(
      conflationMapSegment,
    );

    // console.log(JSON.stringify(terseConflationMapSegment, null, 4));

    const {
      properties: { n },
    } = terseConflationMapSegment;

    // @ts-ignore
    terseConflationMapSegment.tippecanoe = tippecanoeDetails[n];

    // @ts-ignore
    terseConflationMapSegment.properties = _.pick(
      terseConflationMapSegment.properties,
      ['id', 'osm', 'osm_fwd', 'ris', 'tmc', 'n', 'h', 'dir'],
    );

    const good = writeStream.write(
      `${JSON.stringify(terseConflationMapSegment)}\n`,
    );

    if (!good) {
      await new Promise((res) => writeStream.once('drain', res));
    }
  }

  const sentinel = new Promise((resolve) => writeStream.on('close', resolve));

  writeStream.close();

  await sentinel;
};

function generateTileSet(tmpFilePath: string) {
  console.log('generateTileSet');

  spawnSync('tippecanoe', [
    '--no-feature-limit',
    '--no-tile-size-limit',
    '--generate-ids',
    '--read-parallel',
    '--force',
    '-o',
    mbtilesOutputFile,
    tmpFilePath,
  ]);
}

export default async function createMBTiles(
  conflationMapSegmentIter: Generator<ConflationMapSegment>,
) {
  try {
    const tmpobj = tmp.fileSync({ tmpdir: tmpDir, keep: true });

    const tmpFilePath = tmpobj.name;

    console.log('tmpFilePath:', tmpFilePath);

    await outputSegmentsAsNDJSON(conflationMapSegmentIter, tmpFilePath);

    generateTileSet(tmpFilePath);

    // tmpobj.removeCallback();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
