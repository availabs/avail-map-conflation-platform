/* eslint-disable no-await-in-loop */

import { readdirSync } from 'fs';
import { readFile } from 'fs/promises';

import { join } from 'path';

import { intersection as parser } from 'sharedstreets-pbf';

import { SharedStreetsIntersection } from 'sharedstreets-types';

const tileRE = /^12-\d+-\d+\.intersection\.8\.pbf$/;

async function* makeIterator(
  tilePaths: string[],
): AsyncGenerator<SharedStreetsIntersection> {
  for (let i = 0; i < tilePaths.length; ++i) {
    const pbf = await readFile(tilePaths[i]);

    const tileMembers = parser(pbf);

    for (let j = 0; j < tileMembers.length; ++j) {
      yield tileMembers[j];
    }
  }
}

export default function makeSharedStreetsIntersectionAsyncIterator(
  tilesDir: string,
) {
  const tilePaths = readdirSync(tilesDir)
    .filter((f) => f.match(tileRE))
    .map((f) => join(tilesDir, f));

  return makeIterator(tilePaths);
}
