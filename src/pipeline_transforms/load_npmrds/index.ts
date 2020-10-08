/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';
import { strict as assert } from 'assert';
import { dirname } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';
import gdal from 'gdal';
import * as csv from 'fast-csv';
import tar from 'tar';

import {
  loadNpmrds,
  TmcIdentificationPropertiesSchema,
  TmcIdentificationAsyncIterator,
  NpmrdsShapefileIterator,
  TmcIdentificationProperties,
  NpmrdsShapefileFeature,
} from '../../daos/NpmrdsDAO';

// Because prettier and ts-ignore are not working well together.
const tmcIdentPropertyDefs =
  TmcIdentificationPropertiesSchema?.definitions?.TmcIdentificationProperties;

const tmcIdentificationPropertyTypes = _.mapValues(
  // @ts-ignore
  tmcIdentPropertyDefs?.properties,
  (v) => {
    const { type: types } = v;

    const type = Array.isArray(types)
      ? _.first(types.filter((t) => t !== 'null'))
      : types;

    return type;
  },
);

// Because prettier and ts-ignore are not working well together.
const timerId = 'load npmrds';

const getShapefileDirectoryFromTarArchive = (npmrds_shapefile_tgz: string) => {
  let shpFile: null | string = null;

  tar.list({
    file: npmrds_shapefile_tgz,
    sync: true,
    onentry: (readEntry) => {
      const { type, size, path } = readEntry;
      // @ts-ignore
      if (type === 'File' && size > 0 && path.match(/\.shp$/)) {
        // @ts-ignore
        if (shpFile !== null) {
          throw new Error(
            `More than one .shp file found in ${npmrds_shapefile_tgz}.`,
          );
        }
        // @ts-ignore
        shpFile = path;
      }
    },
  });

  if (shpFile === null) {
    throw new Error(`No .shp file found in ${npmrds_shapefile_tgz}.`);
  }

  const shpFileDir = dirname(shpFile) === '.' ? '' : `/${dirname(shpFile)}`;

  return shpFileDir;
};

// Because, for some reason, the template breaks my editor when used below.
const toStr = (v: any) => `${v}`;

const castTmcIdentificationRowValues = (v: any, k: string) => {
  const type = tmcIdentificationPropertyTypes[k];

  if (_.isNil(v) || v === '') {
    return null;
  }
  if (type === 'number') {
    const n = +v;
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'string') {
    return toStr(v);
  }
  return v;
};

async function* makeTmcIdentificationIterator(
  npmrds_tmc_identification_gz: string,
): TmcIdentificationAsyncIterator {
  const stream = csv.parseStream(
    pipeline(createReadStream(npmrds_tmc_identification_gz), createGunzip()),
    { headers: true, trim: true },
  );

  for await (const row of stream) {
    const tmcMetadata: any | TmcIdentificationProperties = _(row)
      .mapKeys((_v, k: string) => k.toLowerCase())
      .pick(Object.keys(tmcIdentificationPropertyTypes))
      .mapValues(castTmcIdentificationRowValues)
      .value();

    yield tmcMetadata;
  }
}

async function* makeNpmrdsShapesIterator(
  npmrds_shapefile_tgz: string,
): NpmrdsShapefileIterator {
  const shpFileDir = getShapefileDirectoryFromTarArchive(npmrds_shapefile_tgz);

  gdal.verbose();
  const dataset = gdal.open(`/vsitar/${npmrds_shapefile_tgz}${shpFileDir}`);

  const { features } = dataset.layers.get(0);

  let feature: null | gdal.Feature = null;

  // eslint-disable-next-line no-cond-assign
  while ((feature = features.next())) {
    const properties: any = _.mapKeys(feature.fields.toObject(), (_v, k) =>
      k.toLowerCase(),
    );

    // @ts-ignore
    const geometry:
      | turf.LineString
      | turf.MultiLineString = feature.getGeometry().toObject();

    const geometryType = turf.getType(geometry);

    assert(geometryType === 'LineString' || geometryType === 'MultiLineString');

    const coords = turf.getCoords(geometry);

    const id = properties?.tmc ?? null;

    const tmcGeoJson: NpmrdsShapefileFeature | any =
      geometryType === 'LineString'
        ? turf.lineString(coords, properties, { id })
        : turf.multiLineString(coords, properties, { id });

    yield tmcGeoJson;
    await new Promise((resolve) => process.nextTick(resolve));
  }
}

export default async ({
  npmrds_tmc_identification_gz,
  npmrds_shapefile_tgz,
}) => {
  console.time(timerId);

  await loadNpmrds(
    makeTmcIdentificationIterator(npmrds_tmc_identification_gz),
    makeNpmrdsShapesIterator(npmrds_shapefile_tgz),
  );

  console.timeEnd(timerId);
};
