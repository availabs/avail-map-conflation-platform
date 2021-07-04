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

const tmpDir = join(outputDirectory, 'tmp');
mkdirSync(tmpDir, { recursive: true });

tmp.setGracefulCleanup();

/*
    The FHWA approved Functional Classification
    System code. If multiple HPMS segments with
    different attribute values are assigned to a single
    TMC path, the value for the highest functional class
    (minimum code value) is assigned.

      Attribute Value: Description
      1: Interstate
      2: Principal Arterial – Other Freeways and Expressways
      3: Principal Arterial – Other
      4: Minor Arterial
      5: Major Collector
      6: Minor Collector
      7: Local
 */
const tippecanoeDetails = {
  1: { layer: 'interstate' },
  2: { minzoom: 7, layer: 'highway' },
  3: { minzoom: 8, layer: 'arterial' },
  4: { minzoom: 9, layer: 'arterial' },
  5: { minzoom: 10, layer: 'collector' },
  6: { minzoom: 11, layer: 'collector' },
  7: { minzoom: 12, layer: 'local' },
};

const mbtilesOutputDir = join(outputDirectory, 'mbtiles');
mkdirSync(mbtilesOutputDir, { recursive: true });

const mbtilesOutputFile = join(mbtilesOutputDir, 'npmrds.mbtiles');

const outputSegmentsAsNDJSON = async (
  npmrdsSegmentsIter: Generator<NpmrdsTmcFeature>,
  tmpFilePath: string,
) => {
  console.log('output NPMRDS Segments as NDJSON');

  const writeStream = createWriteStream(join(tmpFilePath), {
    emitClose: true,
  });

  for (const npmrdsSegment of npmrdsSegmentsIter) {
    const n = npmrdsSegment.properties.f_system;

    // @ts-ignore
    npmrdsSegment.tippecanoe = tippecanoeDetails[+n];

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
    '--generate-ids',
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
