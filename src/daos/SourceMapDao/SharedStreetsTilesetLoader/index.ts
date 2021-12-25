/* eslint-disable no-restricted-syntax, no-underscore-dangle */

// NOTE: The bulkLoaders are kept static so that, someday, they
//       may run in separate processes, concurrently.
//       If they were put into a class instance with
//       a shared database connection, the entire load could
//       happen within a single transaction, serially.

import { join } from 'path';

import {
  SharedStreetsGeometry,
  SharedStreetsMetadata,
  SharedStreetsIntersection,
  SharedStreetsReference,
} from 'sharedstreets-types';

import {
  SharedStreetsTilesetBuildMetadata,
  SharedStreetsOsmTileSource,
} from '../domain/types';

import inputDirectory from '../../../constants/inputDirectory';

import SharedStreetsLoadingInitializer from './SharedStreetsLoadingInitializer';
import SharedStreetsMetadataLoader from './SharedStreetsMetadataLoader';
import SharedStreetsIntersectionLoader from './SharedStreetsIntersectionLoader';
import SharedStreetsGeometryLoader from './SharedStreetsGeometryLoader';
import SharedStreetsReferenceLoader from './SharedStreetsReferenceLoader';
import SharedStreetsLoadingFinisher from './SharedStreetsLoadingFinisher';

export default class SharedStreetsTilesetLoader {
  static getSharedStreetsHome(shstOsmTileSource: SharedStreetsOsmTileSource) {
    return join(inputDirectory, 'shst', shstOsmTileSource);
  }

  static getSharedStreetsTilesetDirectory(
    shstOsmTileSource: SharedStreetsOsmTileSource,
  ) {
    return join(
      SharedStreetsTilesetLoader.getSharedStreetsHome(shstOsmTileSource),
      'shst/.shst/cache/tiles/osm/',
      shstOsmTileSource,
    );
  }

  static getSharedStreetsTilesetBuildMetadataPath(
    shstOsmTileSource: SharedStreetsOsmTileSource,
  ) {
    return join(
      SharedStreetsTilesetLoader.getSharedStreetsHome(shstOsmTileSource),
      'shst_tileset_build_metadata.json',
    );
  }

  static initializeSharedStreetsTilesetLoad({
    shst_osm_tile_source,
    shst_builder_version,
  }: SharedStreetsTilesetBuildMetadata) {
    const initializer = new SharedStreetsLoadingInitializer();

    initializer.setDatabaseToWalMode();

    initializer.setShstTilesetProvenance(
      shst_osm_tile_source,
      shst_builder_version,
    );
  }

  static async bulkLoadShstGeometriesAsync(
    shstGeometryIter: AsyncGenerator<SharedStreetsGeometry>,
  ) {
    return new SharedStreetsGeometryLoader().bulkLoadShstGeometriesAsync(
      shstGeometryIter,
    );
  }

  static async bulkLoadShstMetadataAsync(
    shstMetadataIter: AsyncGenerator<SharedStreetsMetadata>,
  ) {
    return new SharedStreetsMetadataLoader().bulkLoadShstMetadataAsync(
      shstMetadataIter,
    );
  }

  static async bulkLoadShstIntersectionsAsync(
    shstIntersectionsIter: AsyncGenerator<SharedStreetsIntersection>,
  ) {
    return new SharedStreetsIntersectionLoader().bulkLoadShstIntersectionsAsync(
      shstIntersectionsIter,
    );
  }

  static async bulkLoadShstReferencesAsync(
    shstReferenceIter: AsyncGenerator<SharedStreetsReference>,
  ) {
    return new SharedStreetsReferenceLoader().bulkLoadShstReferencesAsync(
      shstReferenceIter,
    );
  }

  static finishSharedStreetsTilesetLoad() {
    const finisher = new SharedStreetsLoadingFinisher();

    finisher.finishSharedStreetsTilesetLoad();
  }
}
