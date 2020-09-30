import { readFileSync, readdirSync } from 'fs';

import { join } from 'path';

import { intersection as parser } from 'sharedstreets-pbf';

import { loadSharedStreetsIntersections } from '../../../daos/SourceMapDao';

const tileRE = /^12-\d+-\d+\.intersection\.8\.pbf$/;

function* makeIterator(tilePaths: string[]) {
  for (let i = 0; i < tilePaths.length; ++i) {
    const pbf = readFileSync(tilePaths[i]);

    const tileMembers = parser(pbf);

    for (let j = 0; j < tileMembers.length; ++j) {
      yield tileMembers[j];
    }
  }
}

export default (tilesDir: string) => {
  const tilePaths = readdirSync(tilesDir)
    .filter((f) => f.match(tileRE))
    .map((f) => join(tilesDir, f));

  const iter = makeIterator(tilePaths);

  loadSharedStreetsIntersections(iter);
};
