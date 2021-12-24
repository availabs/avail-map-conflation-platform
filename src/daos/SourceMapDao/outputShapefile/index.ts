/* eslint-disable no-restricted-syntax */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, isAbsolute } from 'path';

import * as turf from '@turf/turf';
import gdal from 'gdal';
import _ from 'lodash';

import { sync as rimrafSync } from 'rimraf';

import SourceMapDao from '../index';

import { SharedStreetsReferenceFeature } from '../domain/types';

gdal.verbose();

const shstRoadClassEnumDecoder = [
  'Motorway',
  'Trunk',
  'Primary',
  'Secondary',
  'Tertiary',
  'Residential',
  'Unclassified',
  'Service',
  'Other',
];

const layerDefinitionFileTemplate = readFileSync(
  join(__dirname, './SourceMapLayerDefinition.template.qlr'),
).toString();

// @ts-ignore
const wgs84 = gdal.SpatialReference.fromEPSG(4326);

type gdalOFTType = string;

const addFieldToLayer = (layer: gdal.Layer, name: string, type: gdalOFTType) =>
  layer.fields.add(new gdal.FieldDefn(name, type));

const propDefs = {
  shst_reference_id: {
    fieldName: 'shst_ref',
    type: gdal.OFTString,
  },
};

const layers = {};

const getDatasetLayer = (dataset: gdal.Dataset, layerName: string) => {
  if (layers[layerName]) {
    return layers[layerName];
  }

  // @ts-ignore
  const layer = dataset.layers.create(layerName, wgs84, gdal.LineString);
  layers[layerName] = layer;

  _.forEach(propDefs, ({ fieldName, type }) =>
    addFieldToLayer(layer, fieldName, type),
  );

  return layer;
};

const addShstReferenceToLayer = (
  layer: gdal.Layer,
  shstReference: SharedStreetsReferenceFeature,
) => {
  const { id } = shstReference;

  const gdalFeature = new gdal.Feature(layer);

  gdalFeature.fields.set('shst_ref', id);

  const lineString = new gdal.LineString();

  turf
    .getCoords(shstReference)
    .forEach(([lon, lat]) => lineString.points.add(new gdal.Point(lon, lat)));

  gdalFeature.setGeometry(lineString);

  layer.features.add(gdalFeature);
};

export default function outputShapefile({
  shapefile_path,
}: {
  shapefile_path: string;
}) {
  if (!shapefile_path) {
    console.error('The output_file parameter is required');
    process.exit(1);
  }

  const shpfileDirAbsolutePath = isAbsolute(shapefile_path)
    ? shapefile_path
    : join(process.cwd(), shapefile_path);

  if (existsSync(shpfileDirAbsolutePath)) {
    rimrafSync(shpfileDirAbsolutePath);
  }

  const dataset = gdal.open(shpfileDirAbsolutePath, 'w', 'ESRI Shapefile');
  const getLayer = getDatasetLayer.bind(null, dataset);

  const iter = SourceMapDao.makeSharedStreetsReferenceFeaturesIterator();

  for (const shstReference of iter) {
    // const layerName = 'shared_streets';
    const layerName =
      shstRoadClassEnumDecoder[shstReference.properties.minOsmRoadClass];

    const layer = getLayer(layerName);
    addShstReferenceToLayer(layer, shstReference);
  }

  writeFileSync(
    join(shpfileDirAbsolutePath, 'README'),
    `NOTE: The SourceMapLayerDefinition.qlr file is valid ONLY on the machine that generated the shapefile.

      To make a valid SourceMapLayerDefinition.qlr for this machine, run the following command from this directory.

        sed "s|__SHPFILE_PATH__|$PWD|g" SourceMapLayerDefinition.template.qlr > SourceMapLayerDefinition.qlr
  `,
  );

  writeFileSync(
    join(shpfileDirAbsolutePath, 'SourceMapLayerDefinition.template.qlr'),
    layerDefinitionFileTemplate,
  );

  writeFileSync(
    join(shpfileDirAbsolutePath, 'SourceMapLayerDefinition.qlr'),
    layerDefinitionFileTemplate.replace(
      /__SHPFILE_PATH__/g,
      shpfileDirAbsolutePath,
    ),
  );

  dataset.close();
}
