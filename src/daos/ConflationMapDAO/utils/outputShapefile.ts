/* eslint-disable no-restricted-syntax */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import gdal from 'gdal';

import { sync as rimrafSync } from 'rimraf';

import getTerseConflationMapSegment from './getTerseConflationMapSegment';

import { ConflationMapSegment } from '../domain/types';

gdal.verbose();

// @ts-ignore
const wgs84 = gdal.SpatialReference.fromEPSG(4326);

const conflationMapOutputDir = join(
  __dirname,
  '../../../../output/conflation_map',
);

mkdirSync(conflationMapOutputDir, { recursive: true });

const shpfileDir = join(conflationMapOutputDir, 'conflation_map_shp');

const getDatasetLayer = (dataset: gdal.Dataset) => {
  // @ts-ignore
  const layer = dataset.layers.create('conflation_map', wgs84, gdal.LineString);

  layer.fields.add(new gdal.FieldDefn('id', gdal.OFTInteger));
  layer.fields.add(new gdal.FieldDefn('shst', gdal.OFTString));
  layer.fields.add(new gdal.FieldDefn('osm', gdal.OFTInteger));
  layer.fields.add(new gdal.FieldDefn('ris', gdal.OFTInteger));
  layer.fields.add(new gdal.FieldDefn('tmc', gdal.OFTString));
  layer.fields.add(new gdal.FieldDefn('n', gdal.OFTInteger));

  layer.fields.add(new gdal.FieldDefn('dir', gdal.OFTInteger));
  layer.fields.add(new gdal.FieldDefn('rdnum', gdal.OFTInteger));
  layer.fields.add(new gdal.FieldDefn('rdnumdir', gdal.OFTInteger));

  return layer;
};

const addConflationMapSegmentToLayer = (
  layer: gdal.Layer,
  conflationMapSegment: ConflationMapSegment,
) => {
  const terseConflationMapSegment = getTerseConflationMapSegment(
    conflationMapSegment,
  );

  const {
    properties: { id, shst, osm, ris, tmc, n, dir, rdnum, rdnumdir },
  } = terseConflationMapSegment;

  const gdalFeature = new gdal.Feature(layer);

  gdalFeature.fields.set('id', id);
  gdalFeature.fields.set('shst', shst);
  gdalFeature.fields.set('osm', osm);
  gdalFeature.fields.set('ris', ris ?? null);
  gdalFeature.fields.set('tmc', tmc ?? null);
  gdalFeature.fields.set('n', n ?? null);
  gdalFeature.fields.set('dir', dir ?? null);
  gdalFeature.fields.set('rdnum', rdnum ?? null);
  gdalFeature.fields.set('rdnumdir', rdnumdir ?? null);

  const lineString = new gdal.LineString();

  turf
    .getCoords(terseConflationMapSegment)
    .forEach(([lon, lat]) => lineString.points.add(new gdal.Point(lon, lat)));

  gdalFeature.setGeometry(lineString);

  layer.features.add(gdalFeature);
};

export default function outputShapefile(
  conflationMapSegmentIter: Generator<ConflationMapSegment>,
) {
  if (existsSync(shpfileDir)) {
    rimrafSync(shpfileDir);
  }

  const dataset = gdal.open(shpfileDir, 'w', 'ESRI Shapefile');

  const layer = getDatasetLayer(dataset);

  for (const conflationMapSegment of conflationMapSegmentIter) {
    addConflationMapSegmentToLayer(layer, conflationMapSegment);
  }

  dataset.close();
}
