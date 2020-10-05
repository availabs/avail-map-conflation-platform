/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';
import { strict as assert } from 'assert';
import { dirname } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';
import gdal from 'gdal';
import * as csv from 'fast-csv';
import pump from 'pump';
import through2 from 'through2';
import tar from 'tar';

import { loadNpmrds } from '../../daos/NpmrdsDAO';

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

const emitTmcMetadata = (
  npmrdsEmitter: any,
  npmrds_tmc_identification_gz: string,
) =>
  new Promise((resolve, reject) =>
    pump(
      csv.parseStream(
        pipeline(
          createReadStream(npmrds_tmc_identification_gz),
          createGunzip(),
        ),
        { headers: true, trim: true },
      ),
      through2.obj(function loader(raw, _$, cb) {
        const tmcMetadata = _.mapKeys(raw, (_v, k) => k.toLowerCase());

        npmrdsEmitter.emit('metadata', tmcMetadata);

        return cb();
      }),
      (err) => {
        if (err) {
          return reject(err);
        }

        return resolve();
      },
    ),
  );

const handleShapefileFeatureAsync = (
  npmrdsEmitter: any,
  feature: gdal.Feature,
) =>
  new Promise((resolve) =>
    process.nextTick(() => {
      // @ts-ignore
      const geometry:
        | turf.LineString
        | turf.MultiLineString = feature.getGeometry().toObject();
      const geometryType = turf.getType(geometry);

      assert(
        geometryType === 'LineString' || geometryType === 'MultiLineString',
      );

      const coords = turf.getCoords(geometry);

      const properties = feature.fields.toObject();
      // @ts-ignore
      const { Tmc: tmc } = properties;

      const tmcGeoJson =
        geometryType === 'LineString'
          ? turf.lineString(coords, { tmc }, { id: tmc })
          : turf.multiLineString(coords, { tmc }, { id: tmc });

      npmrdsEmitter.emit('shape', tmcGeoJson);
      resolve();
    }),
  );

async function emitTmcGeoJsonShapes(
  npmrdsEmitter: any,
  npmrds_shapefile_tgz: string,
) {
  const shpFileDir = getShapefileDirectoryFromTarArchive(npmrds_shapefile_tgz);

  gdal.verbose();
  const dataset = gdal.open(`/vsitar/${npmrds_shapefile_tgz}${shpFileDir}`);

  const { features } = dataset.layers.get(0);

  let feature: null | gdal.Feature = null;

  // eslint-disable-next-line no-cond-assign
  while ((feature = features.next())) {
    await handleShapefileFeatureAsync(npmrdsEmitter, feature);
  }
}

export default async ({
  npmrds_tmc_identification_gz,
  npmrds_shapefile_tgz,
}) => {
  console.time(timerId);

  const npmrdsEmitter = new EventEmitter();

  try {
    loadNpmrds(npmrdsEmitter);

    await Promise.all([
      emitTmcMetadata(npmrdsEmitter, npmrds_tmc_identification_gz),
      emitTmcGeoJsonShapes(npmrdsEmitter, npmrds_shapefile_tgz),
    ]);

    npmrdsEmitter.emit('done');
  } catch (err) {
    npmrdsEmitter.emit('error', err);
  } finally {
    console.timeEnd(timerId);
  }
};
