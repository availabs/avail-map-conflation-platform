/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { spawnSync } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

import tmp from 'tmp';

import TargetMapDAO from '../../../utils/TargetMapDatabases/TargetMapDAO';

import { NPMRDS as SCHEMA } from '../../../constants/databaseSchemaNames';

import { NpmrdsTmcFeature } from '../raw_map_layer/domain/types';

import outputDirectory from '../../../constants/outputDirectory';

type NpmrdsTargetMapDao = TargetMapDAO<NpmrdsTmcFeature>;

tmp.setGracefulCleanup();

const mbtilesOutputDir = join(outputDirectory, 'qa_mbtiles');

const tmpDir = join(mbtilesOutputDir, 'tmp/');
mkdirSync(tmpDir, { recursive: true });

const mbtilesOutputFile = join(mbtilesOutputDir, 'npmrds_qa.mbtiles');

const outputSegmentsAsNDJSON = async (
  npmrdsSegmentsIter: Generator<NpmrdsTmcFeature>,
  tmpFilePath: string,
) => {
  console.log('output NPMRDS Segments as NDJSON');

  const writeStream = createWriteStream(join(tmpFilePath), {
    emitClose: true,
  });

  for (const npmrdsSegment of npmrdsSegmentsIter) {
    // @ts-ignore
    npmrdsSegment.tippecanoe = { layer: 'npmrds_qa' };
    // @ts-ignore
    npmrdsSegment.properties = { id: npmrdsSegment.id };

    const good = writeStream.write(`${JSON.stringify(npmrdsSegment)}\n`);

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

    const targetMapDao: NpmrdsTargetMapDao = new TargetMapDAO(SCHEMA);

    const tmpobj = tmp.fileSync({ tmpdir: tmpDir, keep: true });

    const tmpFilePath = tmpobj.name;
    console.log(countyName);

    const iter =
      countyName === null
        ? targetMapDao.makeRawEdgeFeaturesIterator()
        : targetMapDao.makeFilteredRawEdgeFeaturesIterator(
            'county',
            countyName,
          );

    await outputSegmentsAsNDJSON(iter, tmpFilePath);

    generateTileSet(tmpFilePath);

    tmpobj.removeCallback();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
