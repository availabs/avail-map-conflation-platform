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
  TmcIdentificationPropertiesSchema,
  TmcIdentificationProperties,
  NpmrdsShapefileFeature,
} from '../domain';

import {
  load,
  TmcIdentificationAsyncIterator,
  NpmrdsShapefileIterator,
} from '../loaders';

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
  county: string | null,
): TmcIdentificationAsyncIterator {
  const stream = csv.parseStream(
    pipeline(createReadStream(npmrds_tmc_identification_gz), createGunzip()),
    { headers: true, trim: true },
  );

  let n = 0;
  let m = 0;
  for await (const row of stream) {
    ++n;
    const tmcMetadata: any | TmcIdentificationProperties = _(row)
      .mapKeys((_v, k: string) => k.toLowerCase())
      .pick(Object.keys(tmcIdentificationPropertyTypes))
      .mapValues(castTmcIdentificationRowValues)
      .value();

    if (county !== null && tmcMetadata.county.toUpperCase() !== county) {
      continue;
    }

    ++m;
    yield tmcMetadata;
  }

  if (county !== null) {
    console.log(
      `${county} matched ${m} of ${n} TMCs in the TMC_Identification file.`,
    );
  }
}

async function* makeNpmrdsShapesIterator(
  npmrds_shapefile_tgz: string,
  county: string | null,
): NpmrdsShapefileIterator {
  const shpFileDir = getShapefileDirectoryFromTarArchive(npmrds_shapefile_tgz);

  gdal.verbose();
  const dataset = gdal.open(`/vsitar/${npmrds_shapefile_tgz}${shpFileDir}`);

  const { features } = dataset.layers.get(0);

  let feature: null | gdal.Feature = null;

  let n = 0;
  let m = 0;
  // eslint-disable-next-line no-cond-assign
  while ((feature = features.next())) {
    ++n;
    const properties: any = _.mapKeys(feature.fields.toObject(), (_v, k) =>
      k.toLowerCase(),
    );

    if (county !== null && properties.county.toUpperCase() !== county) {
      continue;
    }

    ++m;

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

  if (county !== null) {
    console.log(`${county} matched ${m} of ${n} TMCs in the NPMRDS Shapefile.`);
  }
}

export default async function loadRawNpmrdsTables({
  npmrds_tmc_identification_gz,
  npmrds_shapefile_tgz,
  county = null,
}: {
  county: string | null;
  npmrds_tmc_identification_gz: string;
  npmrds_shapefile_tgz: string;
}) {
  const selectedCounty = county && county.toUpperCase();

  console.time(timerId);

  await load(
    makeTmcIdentificationIterator(npmrds_tmc_identification_gz, selectedCounty),
    makeNpmrdsShapesIterator(npmrds_shapefile_tgz, selectedCounty),
  );

  console.timeEnd(timerId);
}
