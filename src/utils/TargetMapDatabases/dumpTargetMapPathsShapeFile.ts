/* eslint-disable no-restricted-syntax */
import { existsSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import gdal from 'gdal';

import { sync as rimrafSync } from 'rimraf';

import { NYS_RIS as SCHEMA } from '../../constants/databaseSchemaNames';

import TargetMapDAO from './TargetMapDAO';

// @ts-ignore
const wgs84 = gdal.SpatialReference.fromEPSG(4326);

const addTargetMapPathsLayer = (
  targetMapDao: TargetMapDAO,
  dataset: gdal.Dataset,
) => {
  // @ts-ignore
  const layer = dataset.layers.create(
    `target_map_paths`,
    wgs84,
    gdal.LineString,
  );

  layer.fields.add(new gdal.FieldDefn('id', gdal.OFTInteger));

  const iter = targetMapDao.makeMergedTargetMapPathIterator();

  for (const feature of iter) {
    const gdalFeature = new gdal.Feature(layer);

    gdalFeature.fields.set('id', feature.id);

    const lineString = new gdal.LineString();

    turf
      .getCoords(feature)
      .forEach(([lon, lat]) => lineString.points.add(new gdal.Point(lon, lat)));

    gdalFeature.setGeometry(lineString);

    layer.features.add(gdalFeature);
  }
};

const targetMapDao = new TargetMapDAO(SCHEMA);
// const targetMapBBDao = new TargetMapConflationBlackboardDao(SCHEMA);

const output_directory = join(process.cwd(), 'target_map_paths_shp');

console.log(output_directory);

if (existsSync(output_directory)) {
  rimrafSync(output_directory);
}

const dataset = gdal.open(output_directory, 'w', 'ESRI Shapefile');

addTargetMapPathsLayer(targetMapDao, dataset);

dataset.close();
