import { join } from 'path';

import { SharedStreetsOsmTileSource } from '../../domain/types';

export function getSharedStreetsHome(
  shstOsmTileSource: SharedStreetsOsmTileSource,
) {
  return join(__dirname, '../../../../../input/shst/', shstOsmTileSource);
}

export function getSharedStreetsTilesetDirectory(
  shstOsmTileSource: SharedStreetsOsmTileSource,
) {
  return join(
    getSharedStreetsHome(shstOsmTileSource),
    'shst/.shst/cache/tiles/osm/',
    shstOsmTileSource,
  );
}

export function getSharedStreetsTilesetBuildMetadataPath(
  shstOsmTileSource: SharedStreetsOsmTileSource,
) {
  return join(
    getSharedStreetsHome(shstOsmTileSource),
    'shst_tileset_build_metadata.json',
  );
}
