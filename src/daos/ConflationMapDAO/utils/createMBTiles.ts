/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { spawnSync } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

import tmp from 'tmp';

import { ConflationMapSegment } from '../domain/types';

const tmpDir = join(__dirname, '../../../../output/conflation_map/tmp');
mkdirSync(tmpDir, { recursive: true });

tmp.setGracefulCleanup();

const tippecanoeDetails = {
  0: { layer: 'interstate' },
  1: { minzoom: 7, layer: 'highway' },
  2: { minzoom: 8, layer: 'arterial' },
  3: { minzoom: 9, layer: 'arterial' },
  4: { minzoom: 10, layer: 'collector' },
  5: { minzoom: 11, layer: 'local' },
  6: { minzoom: 12, layer: 'local' },
  7: { minzoom: 14, layer: 'service' },
};

const mbtilesOutputFile = join(
  __dirname,
  '../../../../output/conflation_map/conflation_map.mbtiles',
);

const outputSegmentsAsNDJSON = async (
  conflationMapSegmentIter: Generator<ConflationMapSegment>,
  tmpFilePath: string,
) => {
  console.log('outputSegmentsAsNDJSON');

  const writeStream = createWriteStream(join(tmpFilePath), {
    emitClose: true,
  });

  for (const partition of conflationMapSegmentIter) {
    const { id } = partition;
    const { shstReferenceId: shst } = partition.properties;
    const osm = partition.properties.osm.targetMapId;
    const ris = partition.properties?.nys_ris?.targetMapId || undefined;
    const tmc = partition.properties?.npmrds?.targetMapId || undefined;

    const netlev = partition.properties.roadClass;

    const feature = {
      ...partition,
      properties: { id, shst, osm, ris, tmc, netlev },
      tippecanoe: tippecanoeDetails[netlev],
    };

    const good = writeStream.write(`${JSON.stringify(feature)}\n`);

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
    const tmpobj = tmp.fileSync({ tmpdir: tmpDir });

    const tmpFilePath = tmpobj.name;

    await outputSegmentsAsNDJSON(conflationMapSegmentIter, tmpFilePath);

    generateTileSet(tmpFilePath);

    tmpobj.removeCallback();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
