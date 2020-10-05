import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import db from '../../../services/DbService';

import getBufferPolygonCoords from '../../../utils/getBufferPolygonCoords';

import { NPMRDS as SCHEMA } from '../../../constants/databaseSchemaNames';

import { handleTmcGeometryIrregularBoundingPolygon } from './anomalyHandlers';

const validDirectionsRE = /N|NORTBOUND|E|EASTBOUND|S|SOUTHBOUND|W|WESTBOUND/i;

const tmcIdentificationColumns = [
  'tmc',
  'type',
  'road',
  'road_order',
  'intersection',
  'tmclinear',
  'country',
  'state',
  'county',
  'zip',
  'direction',
  'start_latitude',
  'start_longitude',
  'end_latitude',
  'end_longitude',
  'miles',
  'frc',
  'border_set',
  'isprimary',
  'f_system',
  'urban_code',
  'faciltype',
  'structype',
  'thrulanes',
  'route_numb',
  'route_sign',
  'route_qual',
  'altrtename',
  'aadt',
  'aadt_singl',
  'aadt_combi',
  'nhs',
  'nhs_pct',
  'strhnt_typ',
  'strhnt_pct',
  'truck',
  'timezone_name',
  'active_start_date',
  'active_end_date',
];

const createNpmrdsTables = (xdb: any) => {
  const sql = readFileSync(join(__dirname, './create_npmrds_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  xdb.exec(sql);
};

const insertTmcMetadata = (xdb: any, metadata: any) =>
  xdb
    .prepare(
      `
        INSERT INTO ${SCHEMA}.tmc_identification (
          ${tmcIdentificationColumns}
        ) VALUES(${tmcIdentificationColumns.map(() => '?')}) ;`,
    )
    .run(
      tmcIdentificationColumns.map((k) => {
        const v = metadata[k];

        if (_.isNil(v)) {
          return null;
        }

        if (k === 'direction' && !v?.match(validDirectionsRE)) {
          return null;
        }

        if (Number.isFinite(+v)) {
          return +v;
        }

        return v;
      }),
    );

const insertTmcShape = (
  xdb: any,
  feature: turf.Feature<turf.LineString | turf.MultiLineString>,
) => {
  xdb
    .prepare(
      `
        INSERT INTO npmrds_shapefile(
          tmc,
          geojson_feature
        ) VALUES(?, json(?)) ; `,
    )
    .run([feature.id, JSON.stringify(feature)]);

  // Coordinates of the feature's bounding polygon.
  const polyCoords = getBufferPolygonCoords(feature);

  if (polyCoords.length !== 1) {
    handleTmcGeometryIrregularBoundingPolygon(feature);
  }

  // Inserts only the first set of coordinates.
  // If this INSERT fails, the database is corrupted.
  //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
  xdb
    .prepare(
      `
        INSERT INTO ${SCHEMA}.npmrds_shapefile_geopoly_idx (
          _shape,
          tmc
        ) VALUES (?, ?) ; `,
    )
    .run([JSON.stringify(_.first(polyCoords)), feature.id]);
};

// https://basarat.gitbook.io/typescript/main-1/typed-event
// eslint-disable-next-line import/prefer-default-export
export async function loadNpmrds(npmrdsEmitter: any) {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    createNpmrdsTables(xdb);

    const sentinel = new Promise((resolve, reject) =>
      npmrdsEmitter
        .on('metadata', insertTmcMetadata.bind(null, xdb))
        .on('shape', insertTmcShape.bind(null, xdb))
        .on('done', resolve)
        .on('error', reject),
    );

    await sentinel;

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
