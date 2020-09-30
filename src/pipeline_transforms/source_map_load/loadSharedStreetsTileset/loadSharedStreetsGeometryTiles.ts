import { readFileSync, readdirSync } from 'fs';

import { join } from 'path';

import { geometry as parser } from 'sharedstreets-pbf';

import { loadSharedStreetsGeometries } from '../../../daos/SourceMapDao';

const tileRE = /^12-\d+-\d+\.geometry\.8\.pbf$/;

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

  loadSharedStreetsGeometries(iter);
};
