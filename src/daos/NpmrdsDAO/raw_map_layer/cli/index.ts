/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { createReadStream, existsSync } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';
import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';
import gdal from 'gdal';
import * as csv from 'fast-csv';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import {
  TmcIdentificationPropertiesSchema,
  NpmrdsShapefileFeature,
  NpmrdsTmcFeature,
} from '../domain';

import {
  load,
  TmcIdentificationAsyncIterator,
  NpmrdsShapefileIterator,
} from '../loaders';

import parseNpmrdsShapefileVersion from '../utils/parseNpmrdsShapefileVersion';
import parseTmcIdentificationVersion from '../utils/parseTmcIdentificationVersion';

import getExpectedNpmrdsShapefileVersionZipPath from './utils/getExpectedNpmrdsShapefileVersionZipPath';
import getExpectedTmcIdentificationVersionGzipPath from './utils/getExpectedTmcIdentificationVersionGzipPath';

import { NPMRDS as SCHEMA } from '../../../../constants/databaseSchemaNames';

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
  tmc_identification_version: string,
): TmcIdentificationAsyncIterator {
  const tmcIdentCsvGzipPath = getExpectedTmcIdentificationVersionGzipPath(
    tmc_identification_version,
  );

  if (!existsSync(tmcIdentCsvGzipPath)) {
    throw new Error(`File does not exists: ${tmcIdentCsvGzipPath}`);
  }

  const stream = csv.parseStream(
    pipeline(createReadStream(tmcIdentCsvGzipPath), createGunzip(), (err) => {
      if (err) {
        throw err;
      }
    }),
    { headers: true, trim: true },
  );

  for await (const row of stream) {
    const tmcMetadata = _(row)
      .mapKeys((_v, k: string) => k.toLowerCase())
      .pick(Object.keys(tmcIdentificationPropertyTypes))
      .mapValues(castTmcIdentificationRowValues)
      .value();

    // @ts-ignore
    yield tmcMetadata;
  }
}

async function* makeNpmrdsShapesIterator(
  npmrds_shapefile_version: string,
): NpmrdsShapefileIterator {
  const npmrdsShapefileVersionZip = getExpectedNpmrdsShapefileVersionZipPath(
    npmrds_shapefile_version,
  );

  if (!existsSync(npmrdsShapefileVersionZip)) {
    throw new Error(`File does not exists: ${npmrdsShapefileVersionZip}`);
  }

  const dataset = gdal.open(
    `/vsizip/${npmrdsShapefileVersionZip}/${npmrds_shapefile_version}`,
  );

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

export default async function loadRawNpmrdsTables({
  tmc_identification_version,
  npmrds_shapefile_version,
}: {
  tmc_identification_version: string;
  npmrds_shapefile_version: string;
}) {
  // Because prettier and ts-ignore are not working well together.
  const timerId = 'load npmrds';

  console.time(timerId);

  const { year: metaYear } = parseTmcIdentificationVersion(
    tmc_identification_version,
  );

  const {
    year: shpYear,
    extractArea: shpExtractArea,
  } = parseNpmrdsShapefileVersion(npmrds_shapefile_version);

  console.log(JSON.stringify({ metaYear, shpYear }, null, 4));

  if (metaYear !== shpYear) {
    // Expected to happen for 2016 and the latest year.
    console.warn(
      'Warning: TMC_Identification and NPMRDS Shapefile year mismatch.',
    );
  }

  await load(
    makeTmcIdentificationIterator(tmc_identification_version),
    makeNpmrdsShapesIterator(npmrds_shapefile_version),
  );

  const targetMapDao = new TargetMapDAO<NpmrdsTmcFeature>(SCHEMA);

  targetMapDao.targetMapIsCenterline = false;

  targetMapDao.mapYear = shpYear;

  targetMapDao.mapVersion = npmrds_shapefile_version;

  targetMapDao.setMetadataProperty(
    'tmcIdentificationVersion',
    tmc_identification_version,
  );

  if (shpExtractArea) {
    targetMapDao.mapExtractArea = shpExtractArea;
  }

  console.timeEnd(timerId);
}
