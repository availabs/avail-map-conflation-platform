// https://github.com/sharedstreets/sharedstreets-js/blob/e159a1bb9e361e1e4f1dd3032d3ed6334465ad08/src/tilePaths.ts#L20
// SharedStreets tilePaths DEFAULT_ZLEVEL = 12;
// We use --tile-hierarchy=8 for shst match

import { readFileSync, existsSync } from 'fs';

import OpenStreetMapDao from '../../../OpenStreetMapDao';

import SharedStreetsTilesetLoader from '..';

import { SharedStreetsTilesetBuildMetadata } from '../../domain/types';

import makeSharedStreetsGeometryAsyncIterator from './utils/makeSharedStreetsGeometryAsyncIterator';
import makeSharedStreetsIntersectionAsyncIterator from './utils/makeSharedStreetsIntersectionAsyncIterator';
import makeSharedStreetsMetadataAsyncIterator from './utils/makeSharedStreetsMetadataAsyncIterator';
import makeSharedStreetsReferencesAsyncIterator from './utils/makeSharedStreetsReferencesAsyncIterator';

async function loadSharedStreetsTileset(
  shstTilesetDir: string,
  shstTilesetBuildMeta: SharedStreetsTilesetBuildMetadata,
) {
  try {
    SharedStreetsTilesetLoader.initializeSharedStreetsTilesetLoad(
      shstTilesetBuildMeta,
    );

    await SharedStreetsTilesetLoader.bulkLoadShstGeometriesAsync(
      makeSharedStreetsGeometryAsyncIterator(shstTilesetDir),
    );

    await SharedStreetsTilesetLoader.bulkLoadShstIntersectionsAsync(
      makeSharedStreetsIntersectionAsyncIterator(shstTilesetDir),
    );

    await SharedStreetsTilesetLoader.bulkLoadShstMetadataAsync(
      makeSharedStreetsMetadataAsyncIterator(shstTilesetDir),
    );

    await SharedStreetsTilesetLoader.bulkLoadShstReferencesAsync(
      makeSharedStreetsReferencesAsyncIterator(shstTilesetDir),
    );

    SharedStreetsTilesetLoader.finishSharedStreetsTilesetLoad();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

const main = async () => {
  try {
    const shst_osm_tile_source = OpenStreetMapDao.osmVersion;

    const shstTilesetDir = SharedStreetsTilesetLoader.getSharedStreetsTilesetDirectory(
      shst_osm_tile_source,
    );
    const shstTilesetBuildMetaPath = SharedStreetsTilesetLoader.getSharedStreetsTilesetBuildMetadataPath(
      shst_osm_tile_source,
    );

    if (!existsSync(shstTilesetDir)) {
      throw new Error(
        `SharedStreets tileset directory ${shstTilesetDir} does not exist.`,
      );
    }

    if (!existsSync(shstTilesetBuildMetaPath)) {
      throw new Error(
        `SharedStreets tileset build metadata file ${shstTilesetBuildMetaPath} does not exist.`,
      );
    }

    const shstTilesetBuildMeta = JSON.parse(
      readFileSync(shstTilesetBuildMetaPath, { encoding: 'utf8' }),
    );

    loadSharedStreetsTileset(shstTilesetDir, shstTilesetBuildMeta);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export default main;
