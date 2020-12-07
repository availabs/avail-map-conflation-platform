/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { dirname } from 'path';
import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';
import gdal from 'gdal';
import tar from 'tar';

import {
  loadNysRis,
  NysRoadInventorySystemGeodatabaseEntry,
  NysRoadInventorySystemGeodatabaseEntryIterator,
} from '../loaders';

const timerId = 'load nys ris';

// @ts-ignore
const T_SRS = gdal.SpatialReference.fromEPSG(4326);

const handleGdbEntry = (
  feature: gdal.Feature,
): NysRoadInventorySystemGeodatabaseEntry | null => {
  const { fid } = feature;
  try {
    const properties: any = _.mapKeys(feature.fields.toObject(), (_v, k) =>
      k.toLowerCase(),
    );

    properties.fid = fid;

    // @ts-ignore
    const geometry: gdal.MultiLineString = feature.getGeometry();
    geometry.transformTo(T_SRS);

    // https://github.com/naturalatlas/node-gdal/issues/263#issuecomment-520882777
    // @ts-ignore
    geometry.coordinateDimension = 2;

    assert(geometry.wkbType === gdal.wkbMultiLineString);

    // @ts-ignore
    const geojson: turf.MultiLineString = geometry.toObject();

    turf.geojsonType(geojson, 'MultiLineString', 'handleGdbEntryAsync');

    // Clean up the coordinates so turf.lineString or turf.multiLineString don't throw errors.
    const geomCoords = geojson?.coordinates?.reduce(
      (acc: turf.Position[][], positionArr) => {
        // Remove the empty positions
        const filteredLineStringCoords = positionArr.filter(
          (pointCoords) => !_.isEmpty(pointCoords),
        );

        // If there are any positions, push to the multiLineString Position[][]
        if (!_.isEmpty(filteredLineStringCoords)) {
          acc.push(filteredLineStringCoords);
        }

        return acc;
      },
      [],
    );

    const coords = geomCoords?.length > 0 ? geojson.coordinates : null;

    const shape: null | turf.Feature<turf.LineString | turf.MultiLineString> =
      coords &&
      // prefer LineString to MultiLineString
      (coords?.length === 1
        ? turf.lineString(coords[0], { fid }, { id: fid })
        : turf.multiLineString(coords, { fid }, { id: fid }));

    return { properties, shape };
  } catch (err) {
    console.error('NYS RIS FID:', fid);
    console.error(err);
    return null;
  }
};

function* makeNysRisGeodatabaseIterator(
  nys_ris_geodatabase_tgz: string,
  county: string | null = null,
): NysRoadInventorySystemGeodatabaseEntryIterator {
  let gdbtableFile: null | string = null;

  tar.list({
    file: nys_ris_geodatabase_tgz,
    sync: true,
    onentry: (readEntry) => {
      const { type, size, path } = readEntry;
      // @ts-ignore
      if (type === 'File' && size > 0 && path.match(/\.gdbtable/)) {
        // @ts-ignore
        gdbtableFile = path;
      }
    },
  });

  if (gdbtableFile === null) {
    throw new Error(`No .gdbtable file found in ${nys_ris_geodatabase_tgz}.`);
  }

  const gdbtableFileDir =
    dirname(gdbtableFile) === '.' ? '' : `/${dirname(gdbtableFile)}`;

  gdal.verbose();

  const dataset = gdal.open(
    `/vsitar/${nys_ris_geodatabase_tgz}${gdbtableFileDir}`,
  );

  const { features } = dataset.layers.get(0);

  let feature: null | gdal.Feature = null;

  let n = 0;
  let m = 0;

  // eslint-disable-next-line no-cond-assign
  while ((feature = features.next())) {
    const d = handleGdbEntry(feature);
    ++n;

    if (d !== null) {
      if (
        county !== null &&
        d.properties?.county_name?.toUpperCase() !== county.toUpperCase()
      ) {
        continue;
      }

      ++m;
      yield d;
    }
  }

  if (county !== null) {
    console.log(
      `${county} matched ${m} of ${n} entries in the NYS RIS Geodatabase.`,
    );
  }
}

export default async ({ nys_ris_geodatabase_tgz, county }) => {
  console.time(timerId);

  try {
    const nysRisEntryIterator = makeNysRisGeodatabaseIterator(
      nys_ris_geodatabase_tgz,
      county?.toUpperCase(),
    );

    loadNysRis(nysRisEntryIterator);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    console.timeEnd(timerId);
  }
};
