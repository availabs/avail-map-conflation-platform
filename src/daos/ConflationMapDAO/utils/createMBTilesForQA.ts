/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { spawnSync } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

import tmp from 'tmp';

import { ConflationMapSegment } from '../domain/types';

tmp.setGracefulCleanup();

const mbtilesOutputDir = join(__dirname, '../../../../output/qa_mbtiles');

const tmpDir = join(mbtilesOutputDir, 'tmp/');
mkdirSync(tmpDir, { recursive: true });

const mbtilesOutputFile = join(mbtilesOutputDir, 'conflation_map_qa.mbtiles');

const outputSegmentsAsNDJSON = async (
  conflationMapSegmentIter: Generator<ConflationMapSegment>,
  tmpFilePath: string,
) => {
  console.log('outputSegmentsAsNDJSON');

  const writeStream = createWriteStream(join(tmpFilePath), {
    emitClose: true,
  });

  for (const conflationMapSegment of conflationMapSegmentIter) {
    // @ts-ignore
    conflationMapSegment.tippecanoe = { layer: 'conflation_map_qa' };

    // @ts-ignore
    conflationMapSegment.properties = {
      id: conflationMapSegment.properties.id,
    };

    const good = writeStream.write(`${JSON.stringify(conflationMapSegment)}\n`);

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

    await outputSegmentsAsNDJSON(conflationMapSegmentIter, tmpFilePath);

    generateTileSet(tmpFilePath);

    tmpobj.removeCallback();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
