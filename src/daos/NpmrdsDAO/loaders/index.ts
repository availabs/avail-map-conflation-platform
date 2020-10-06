// eslint-disable

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import db from '../../../services/DbService';

import getBufferPolygonCoords from '../../../utils/getBufferPolygonCoords';

import { NPMRDS as SCHEMA } from '../../../constants/databaseSchemaNames';

import { handleTmcGeometryIrregularBoundingPolygon } from './anomalyHandlers';

import {
  tmcIdentificationValidator,
  npmrdsShapefileFeatureValidator,
  TmcIdentificationProperties,
  NpmrdsShapefileFeature,
} from '../typing';

interface TmcIdentificationAsyncIterator
  extends AsyncGenerator<TmcIdentificationProperties, void, unknown> {}

interface NpmrdsShapefileIterator
  extends AsyncGenerator<NpmrdsShapefileFeature, void, unknown> {}

export const validDirectionsRE = /N|NORTBOUND|E|EASTBOUND|S|SOUTHBOUND|W|WESTBOUND/i;

export const tmcIdentificationColumns = [
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

export const npmrdsShapefileColumns = [
  'tmc',
  'type',
  'roadnumber',
  'roadname',
  'firstname',
  'lineartmc',
  'country',
  'state',
  'county',
  'zip',
  'direction',
  'frc',
  'feature',
];

const createNpmrdsTables = (xdb: any) => {
  const sql = readFileSync(join(__dirname, './create_npmrds_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  xdb.exec(sql);
};

const insertTmcMetadata = (xdb: any, metadata: TmcIdentificationProperties) =>
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

        if (_.isNil(v) || v === '') {
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

const insertTmcShape = (xdb: any, feature: NpmrdsShapefileFeature) => {
  const {
    properties: { tmc },
  } = feature;

  xdb
    .prepare(
      `
        INSERT INTO ${SCHEMA}.npmrds_shapefile(
          ${npmrdsShapefileColumns}
        ) VALUES(${npmrdsShapefileColumns.map((c) =>
          c === 'feature' ? 'json(?)' : '?',
        )}) ; `,
    )
    .run(
      npmrdsShapefileColumns.map((k) => {
        const v = feature.properties[k];

        if (k === 'feature') {
          const f: any = { ...feature };
          f.properties = { tmc };
          f.id = tmc;
          return JSON.stringify(f);
        }

        if (_.isNil(v) || v === '') {
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

async function loadTmcIdentfication(
  xdb: any,
  tmcIdentificationAsyncIterator: TmcIdentificationAsyncIterator,
) {
  // eslint-disable-next-line no-restricted-syntax
  for await (const metadata of tmcIdentificationAsyncIterator) {
    if (!tmcIdentificationValidator(metadata)) {
      console.log(JSON.stringify(tmcIdentificationValidator.errors, null, 4));
      throw new Error('Invalid TMC Identification entry.');
    }

    insertTmcMetadata(xdb, metadata);
  }
}

async function loadNpmrdsShapefile(
  xdb: any,
  npmrdsShapefileIterator: NpmrdsShapefileIterator,
) {
  // eslint-disable-next-line no-restricted-syntax
  for await (const shape of npmrdsShapefileIterator) {
    npmrdsShapefileFeatureValidator(shape);
    insertTmcShape(xdb, shape);
  }
}

// eslint-disable-next-line import/prefer-default-export
export async function loadNpmrds(
  tmcIdentificationAsyncIterator: TmcIdentificationAsyncIterator,
  npmrdsShapefileIterator: NpmrdsShapefileIterator,
) {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    createNpmrdsTables(xdb);

    await Promise.all([
      loadTmcIdentfication(xdb, tmcIdentificationAsyncIterator),
      loadNpmrdsShapefile(xdb, npmrdsShapefileIterator),
    ]);

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    xdb.exec(`VACUUM ${SCHEMA};`);
    db.closeLoadingConnectionToDb(xdb);
  }
}
