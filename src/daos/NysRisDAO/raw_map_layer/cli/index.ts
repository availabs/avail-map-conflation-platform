/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { dirname } from 'path';
import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';
import gdal, { Dataset } from 'gdal';
import tar from 'tar';

import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';
import * as csv from 'fast-csv';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import { NysRoadInventorySystemFeature } from '../domain/types';

import {
  loadNysRis,
  NysRoadInventorySystemGeodatabaseEntry,
  NysRoadInventorySystemGeodatabaseEntryIterator,
  TrafficCountStationYearDirectionAsyncIterator,
} from '../loaders';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

const timerId = 'load nys ris';

// @ts-ignore
const T_SRS = gdal.SpatialReference.fromEPSG(4326);

const handleGdbEntry = (
  feature: gdal.Feature,
): NysRoadInventorySystemGeodatabaseEntry | null => {
  const { fid } = feature;
  try {
    const properties: any = _.mapKeys(feature.fields.toObject(), (_v, k) => {
      const p = k.replace(/_{2,}/g, '_').toLowerCase();

      if (p === 'olap_hierarchy') {
        return 'overlap_hierarchy';
      }

      if (p === 'ramp_dest_dot') {
        return 'ramp_dest_dot_id';
      }

      if (p === 'percent_peak_combp') {
        return 'percent_peak_combo';
      }

      return p;
    });

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
    console.warn('Error loading NYS RIS FID:', fid, '---', err.message);
    return null;
  }
};

function getGdbDataset(nys_ris_geodatabase_tgz: string): Dataset {
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

  // gdal.verbose();

  const dataset = gdal.open(
    `/vsitar/${nys_ris_geodatabase_tgz}${gdbtableFileDir}`,
  );

  return dataset;
}

function* makeNysRisGeodatabaseIterator(
  dataset: Dataset,
  ssYearRange: [number, number] | null,
  county: string | null = null,
): NysRoadInventorySystemGeodatabaseEntryIterator {
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

async function* makeTrafficCountStationYearDirectionAsyncIterator(
  traffic_count_station_year_direction_gz: string,
): TrafficCountStationYearDirectionAsyncIterator {
  const stream = csv.parseStream(
    pipeline(
      createReadStream(traffic_count_station_year_direction_gz),
      createGunzip(),
      (err) => {
        if (err) {
          throw err;
        }
      },
    ),
    { headers: true, trim: true },
  );

  for await (const {
    rc_station: rcStation,
    year,
    federal_direction,
  } of stream) {
    const federalDirection = +federal_direction;

    if (federalDirection === 0 || federalDirection === 9) {
      continue;
    }

    yield { rcStation, year: +year, federalDirection };
  }
}

const getSSYearRange = (dataset: Dataset): [number, number] | null => {
  const years = dataset.layers
    .get(0)
    .fields.getNames()
    .map((f) => f.toLowerCase())
    .filter((f) => /^ss_\d{4}$/.test(f))
    .sort()
    .map((f) => +f.replace(/^ss_/, ''));

  if (years.length === 0) {
    return null;
  }

  // @ts-ignore
  return [_.first(years), _.last(years)];
};

export default async ({
  nys_ris_geodatabase_tgz,
  traffic_count_station_year_direction_gz,
  county,
  year,
}) => {
  console.time(timerId);

  try {
    const dataset = getGdbDataset(nys_ris_geodatabase_tgz);

    const ssYearRange = getSSYearRange(dataset);

    const nysRisEntryIterator = makeNysRisGeodatabaseIterator(
      dataset,
      ssYearRange,
      county?.toUpperCase(),
    );

    const trafficCountStationYearDirectionAsyncIterator = makeTrafficCountStationYearDirectionAsyncIterator(
      traffic_count_station_year_direction_gz,
    );

    await loadNysRis(
      nysRisEntryIterator,
      trafficCountStationYearDirectionAsyncIterator,
      year,
      ssYearRange,
    );

    const targetMapDao = new TargetMapDAO<NysRoadInventorySystemFeature>(
      SCHEMA,
    );

    targetMapDao.targetMapIsCenterline = true;
    targetMapDao.mapYear = year;
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    console.timeEnd(timerId);
  }
};
