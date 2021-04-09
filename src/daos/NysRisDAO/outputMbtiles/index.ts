/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { spawnSync } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

import tmp from 'tmp';

import TargetMapDAO from '../../../utils/TargetMapDatabases/TargetMapDAO';

import { NYS_RIS as SCHEMA } from '../../../constants/databaseSchemaNames';

import { NysRoadInventorySystemFeature } from '../raw_map_layer/domain/types';

type NysRisTargetMapDao = TargetMapDAO<NysRoadInventorySystemFeature>;

const tmpDir = join(__dirname, '../../../../output/nys_ris_mbtiles_tmp');
mkdirSync(tmpDir, { recursive: true });

tmp.setGracefulCleanup();

/*
  npmrds_production=# select * from nysdot_functional_classification_code_descriptions;
   code |   distinctor    |                  description                  
  ------+-----------------+-----------------------------------------------
      1 | NYS Codes Rural | Principal Arterial - Interstate
      2 | NYS Codes Rural | Principal Arterial - Other Freeway/Expressway
      4 | NYS Codes Rural | Principal Arterial - Other
      6 | NYS Codes Rural | Minor Arterial
      7 | NYS Codes Rural | Major Collector
      8 | NYS Codes Rural | Minor Collector
      9 | NYS Codes Rural | Local
     11 | NYS Codes Urban | Principal Arterial - Interstate
     12 | NYS Codes Urban | Principal Arterial - Other Freeway/Expressway
     14 | NYS Codes Urban | Principal Arterial - Other
     16 | NYS Codes Urban | Minor Arterial
     17 | NYS Codes Urban | Major Collector
     18 | NYS Codes Urban | Minor Collector
     19 | NYS Codes Urban | Local
*/
const tippecanoeDetails = {
  1: { layer: 'interstate' },
  2: { minzoom: 7, layer: 'highway' },
  4: { minzoom: 8, layer: 'arterial' },
  6: { minzoom: 9, layer: 'arterial' },
  7: { minzoom: 10, layer: 'collector' },
  8: { minzoom: 11, layer: 'collector' },
  9: { minzoom: 12, layer: 'local' },
};

const mbtilesOutputDir = join(__dirname, '../../../../output/mbtiles/');
mkdirSync(mbtilesOutputDir, { recursive: true });

const mbtilesOutputFile = join(mbtilesOutputDir, 'nys_ris.mbtiles');

const outputSegmentsAsNDJSON = async (
  nysRisSegmentsIter: Generator<NysRoadInventorySystemFeature>,
  tmpFilePath: string,
) => {
  console.log('output NYS RIS Segments as NDJSON');

  const writeStream = createWriteStream(join(tmpFilePath), {
    emitClose: true,
  });

  for (const nysRisSegment of nysRisSegmentsIter) {
    const n = nysRisSegment.properties.functional_class;

    // @ts-ignore
    nysRisSegment.tippecanoe = tippecanoeDetails[+n % 10];

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

    tmpobj.removeCallback();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
