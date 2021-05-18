/* eslint-disable import/prefer-default-export */

// TODO: Add ShstTilesetArchiveExtractor

import handler from '.';

import {
  getSharedStreetsTilesetDirectory,
  getSharedStreetsTilesetBuildMetadataPath,
} from '../utils/getSharedStreetsTilesetPaths';

import shrinkwrapDatabase from './utils/shrinkwrapDatabase';

const tilesetBuildMetadataPath = getSharedStreetsTilesetBuildMetadataPath(
  '<shst_osm_tile_source>',
);

const tilesetDir = getSharedStreetsTilesetDirectory('<shst_osm_tile_source>');

const command = 'load_shst_tileset';

const desc = `Load the SharedStreets tileset into SQLite. The loaded tileset version is determined by the loaded OSM version. (The OSM database MUST be loaded prior to loading the SharedStreets database.) The tileset is expected to be found in ${tilesetDir}. The SharedStreets tileset MUST be in the conventional directory during loading and the ShstMatch stage of the conflation pipeline. Additionally, a tileset build metadata file must exist at ${tilesetBuildMetadataPath}. This file is created automatically using this  repository's build_shst_tileset command for data provenance archiving.`;

const builder = {
  // shst_osm_tile_source: {
  // desc:
  // 'SharedStreets OSM tile source. For example, "new-york-170101". Note that this is used as the sharedstreets-js --tile-source flag with "osm/" automatically prepended.',
  // type: 'string',
  // demand: true,
  // },
};

export const loadShstTileset = {
  command,
  desc,
  builder,
  handler,
};

export const shrinkwrapSourceMapDatabase = {
  command: 'shrinkwrap_source_map_database',
  desc: 'Make the SourceMap database Read-Only',
  handler: shrinkwrapDatabase,
};
