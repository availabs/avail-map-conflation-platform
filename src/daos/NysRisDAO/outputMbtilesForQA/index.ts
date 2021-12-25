/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { spawnSync } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

import tmp from 'tmp';

import TargetMapDAO from '../../../utils/TargetMapDatabases/TargetMapDAO';

import { NYS_RIS as SCHEMA } from '../../../constants/databaseSchemaNames';

import { NysRoadInventorySystemFeature } from '../raw_map_layer/domain/types';

import outputDirectory from '../../../constants/outputDirectory';

type NysRisTargetMapDao = TargetMapDAO<NysRoadInventorySystemFeature>;

tmp.setGracefulCleanup();

const mbtilesOutputDir = join(outputDirectory, 'qa_mbtiles');

const tmpDir = join(mbtilesOutputDir, 'tmp/');
mkdirSync(tmpDir, { recursive: true });

const mbtilesOutputFile = join(mbtilesOutputDir, 'nys_ris_qa.mbtiles');

const outputSegmentsAsNDJSON = async (
  nysRisSegmentsIter: Generator<NysRoadInventorySystemFeature>,
  tmpFilePath: string,
) => {
  console.log('output NYS RIS Segments as NDJSON');

  const writeStream = createWriteStream(join(tmpFilePath), {
    emitClose: true,
  });

  for (const nysRisSegment of nysRisSegmentsIter) {
    // @ts-ignore
    nysRisSegment.tippecanoe = { layer: 'nys_ris_qa', minzoom: 1 };
    // @ts-ignore
    nysRisSegment.properties = { id: nysRisSegment.id };

    const good = writeStream.write(`${JSON.stringify(nysRisSegment)}\n`);

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

  console.log(mbtilesOutputFile);
  console.log(tmpFilePath);

  spawnSync('tippecanoe', [
    '--no-feature-limit',
    '--no-tile-size-limit',
    '--no-tile-stats',
    '--read-parallel',
    '--force',
    '-o',
    mbtilesOutputFile,
    tmpFilePath,
  ]);
}

export default async function createMBTiles({ county = null }) {
  try {
    // @ts-ignore
    const countyName = county && county.toUpperCase();

    const targetMapDao: NysRisTargetMapDao = new TargetMapDAO(SCHEMA);

    const tmpobj = tmp.fileSync({ tmpdir: tmpDir, keep: true });

    const tmpFilePath = tmpobj.name;

    const iter =
      countyName === null
        ? targetMapDao.makeRawEdgeFeaturesIterator()
        : targetMapDao.makeFilteredRawEdgeFeaturesIterator(
            'county_name',
            countyName,
          );

    await outputSegmentsAsNDJSON(iter, tmpFilePath);

    generateTileSet(tmpFilePath);

    // tmpobj.removeCallback();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
