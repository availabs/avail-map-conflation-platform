// https://github.com/sharedstreets/sharedstreets-js/blob/e159a1bb9e361e1e4f1dd3032d3ed6334465ad08/src/tilePaths.ts#L20
// SharedStreets tilePaths DEFAULT_ZLEVEL = 12;
// We use --tile-hierarchy=8 for shst match

import { existsSync, writeFileSync } from 'fs';

import { join, isAbsolute } from 'path';

import loadSharedStreetsTileset from './loadSharedStreetsTileset';

const main = async ({ shst_tile_cache_dir, shst_tile_source, output_dir }) => {
  try {
    const shstCacheDir = isAbsolute(shst_tile_cache_dir)
      ? shst_tile_cache_dir
      : join(process.cwd(), shst_tile_cache_dir);

    const shstTilesDir = join(
      shstCacheDir,
      `.shst/cache/tiles/osm/planet-${shst_tile_source}`,
    );

    if (!existsSync(shstTilesDir)) {
      throw new Error(`directory ${shstTilesDir} does not exist.`);
    }

    loadSharedStreetsTileset(shstTilesDir);

    const shstConfigPath = join(output_dir, 'sharedstreets_config.json');

    writeFileSync(
      shstConfigPath,
      JSON.stringify({ shst_tile_cache_dir, shst_tile_source }),
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export default main;
