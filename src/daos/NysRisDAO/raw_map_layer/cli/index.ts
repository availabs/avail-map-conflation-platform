/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';
import gdal, { Dataset } from 'gdal';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import getExpectedNysRisVersionZipPath from '../utils/getExpectedNysRisVersionZipPath';

import { NysRoadInventorySystemFeature } from '../domain/types';

import {
  loadNysRis,
  NysRoadInventorySystemGeodatabaseEntry,
  NysRoadInventorySystemGeodatabaseEntryIterator,
} from '../loaders';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

gdal.verbose();

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

function getGdbDataset(nys_ris_version: string): Dataset {
  const gdbZipPath = getExpectedNysRisVersionZipPath(nys_ris_version);

  // $ ogrinfo \
  //   -al -so -ro \
  //   /vsizip/rensselaer-county_nys-ris-20200921.gdb.zip/rensselaer-county_nys-ris-20200921.gdb \
  //   | head -1
  //
  //   INFO: Open of `/vsizip/rensselaer-county_nys-ris-20200921.gdb.zip/rensselaer-county_nys-ris-20200921.gdb'

  const dataset = gdal.open(`/vsizip/${gdbZipPath}/${nys_ris_version}.gdb`);

  return dataset;
}

function* makeNysRisGeodatabaseIterator(
  dataset: Dataset,
): NysRoadInventorySystemGeodatabaseEntryIterator {
  const { features } = dataset.layers.get(0);

  let feature: null | gdal.Feature = null;

  // eslint-disable-next-line no-cond-assign
  while ((feature = features.next())) {
    const d = handleGdbEntry(feature);
    if (d !== null) {
      yield d;
    }
  }
}

export default async ({ nys_ris_version }) => {
  console.time(timerId);

  try {
    const dataset = getGdbDataset(nys_ris_version);

    const nysRisEntryIterator = makeNysRisGeodatabaseIterator(dataset);

    await loadNysRis(nysRisEntryIterator);

    const targetMapDao = new TargetMapDAO<NysRoadInventorySystemFeature>(
      SCHEMA,
    );

    targetMapDao.targetMapIsCenterline = true;
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    console.timeEnd(timerId);
  }
};
