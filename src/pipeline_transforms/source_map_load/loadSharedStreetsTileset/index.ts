// https://github.com/sharedstreets/sharedstreets-js/blob/e159a1bb9e361e1e4f1dd3032d3ed6334465ad08/src/tilePaths.ts#L20
// SharedStreets tilePaths DEFAULT_ZLEVEL = 12;
// We use --tile-hierarchy=8 for shst match

import loadSharedStreetsGeometryTiles from './loadSharedStreetsGeometryTiles';
import loadSharedStreetsIntersectionTiles from './loadSharedStreetsIntersectionTiles';
import loadSharedStreetsMetadataTiles from './loadSharedStreetsMetadataTiles';
import loadSharedStreetsReferencesTiles from './loadSharedStreetsReferencesTiles';
import finishSharedStreetsLoad from './finishSharedStreetsLoad';

export default (shstTilesDir: string) => {
  try {
    // loadSharedStreetsGeometryTiles(shstTilesDir);
    // loadSharedStreetsIntersectionTiles(shstTilesDir);
    // loadSharedStreetsMetadataTiles(shstTilesDir);
    // loadSharedStreetsReferencesTiles(shstTilesDir);
    finishSharedStreetsLoad();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
