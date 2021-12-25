/* eslint-disable no-await-in-loop */

import { readdirSync } from 'fs';
import { readFile } from 'fs/promises';

import { join } from 'path';

import { geometry as parser } from 'sharedstreets-pbf';

import { SharedStreetsGeometry } from 'sharedstreets-types';

const tileRE = /^12-\d+-\d+\.geometry\.8\.pbf$/;

async function* makeIterator(
  tilePaths: string[],
): AsyncGenerator<SharedStreetsGeometry> {
  for (let i = 0; i < tilePaths.length; ++i) {
    const pbf = await readFile(tilePaths[i]);

    const tileMembers = parser(pbf);

    for (let j = 0; j < tileMembers.length; ++j) {
      yield tileMembers[j];
    }
  }
}

export default function makeSharedStreetsGeometryAsyncIterator(
  tilesDir: string,
) {
  const tilePaths = readdirSync(tilesDir)
    .filter((f) => f.match(tileRE))
    .map((f) => join(tilesDir, f));

  return makeIterator(tilePaths);
}
