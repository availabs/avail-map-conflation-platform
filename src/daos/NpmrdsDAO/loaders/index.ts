import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database } from 'better-sqlite3';

import db from '../../../services/DbService';

import getBufferPolygonCoords from '../../../utils/getBufferPolygonCoords';

import { NPMRDS as SCHEMA } from '../../../constants/databaseSchemaNames';

import {
  handleTmcGeometryIrregularBoundingPolygon,
  handleTmcIdentificationInputDataSchemaInconsistency,
  handleAlwaysNullTmcIdentificationColumns,
  handleNpmrdsShapefileInputDataSchemaInconsistency,
  handleAlwaysNullNpmrdsShapefileColumns,
} from './anomalyHandlers';

import {
  validateTmcIdentificationProperties,
  validateNpmrdsShapefileFeature,
  TmcIdentificationProperties,
  NpmrdsShapefileFeature,
} from '../typing';

export interface TmcIdentificationAsyncIterator
  extends AsyncGenerator<TmcIdentificationProperties, void, unknown> {}

export interface NpmrdsShapefileIterator
  extends AsyncGenerator<NpmrdsShapefileFeature, void, unknown> {}

const createNpmrdsTables = (xdb: any) => {
  const sql = readFileSync(join(__dirname, './create_npmrds_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  xdb.exec(sql);
};

const compareSchemas = (
  databaseTableColumns: readonly string[],
  inputData: object,
) => {
  const dbCols = databaseTableColumns.filter((c) => c !== 'feature');

  const inputProps: readonly string[] = Object.keys(inputData);

  const dbOnly = _.difference(dbCols, inputProps);
  const inputOnly = _.difference(inputProps, dbCols);

  return dbOnly.length > 0 || inputOnly.length > 0
    ? { dbOnly, inputOnly }
    : null;
};

const prepareTmcIdentificationInsertStmt = (
  xdb: Database,
  tmcIdentificationColumns: readonly string[],
) =>
  xdb.prepare(
    `
      INSERT INTO ${SCHEMA}.tmc_identification (
        ${tmcIdentificationColumns}
      ) VALUES(${tmcIdentificationColumns.map(() => '?')}) ;
    `,
  );

const getTmcIdentificationInsertValues = (
  properties: TmcIdentificationProperties,
  nonNullColumnsTracker: Record<string, boolean>,
  c: string,
) => {
  let v = properties[c];

  if (_.isNil(v) || v === '') {
    v = null;
  }

  // eslint-disable-next-line no-param-reassign
  nonNullColumnsTracker[c] = nonNullColumnsTracker[c] || v !== null;

  return v;
};

const compareTmcIdentificationSchemas = (
  tmcIdentificationColumns: readonly string[],
  tmcIdentProps: TmcIdentificationProperties,
) => {
  const diff = compareSchemas(tmcIdentificationColumns, tmcIdentProps);

  if (diff) {
    const { dbOnly, inputOnly } = diff;
    handleTmcIdentificationInputDataSchemaInconsistency(dbOnly, inputOnly);
  }
};

async function loadTmcIdentfication(
  xdb: any,
  tmcIdentificationAsyncIterator: TmcIdentificationAsyncIterator,
) {
  const tmcIdentificationColumns: readonly string[] = xdb
    .pragma("table_info('tmc_identification')")
    .map(({ name }) => name);

  const tmcIdentificationInsertStmt = prepareTmcIdentificationInsertStmt(
    xdb,
    tmcIdentificationColumns,
  );

  const nonNullColumnsTracker = tmcIdentificationColumns.reduce((acc, c) => {
    acc[c] = false;
    return acc;
  }, {});

  let comparedSchemas = false;
  // eslint-disable-next-line no-restricted-syntax
  for await (const tmcIdentProps of tmcIdentificationAsyncIterator) {
    if (!comparedSchemas) {
      compareTmcIdentificationSchemas(tmcIdentificationColumns, tmcIdentProps);
      comparedSchemas = true;
    }

    try {
      validateTmcIdentificationProperties(tmcIdentProps);
    } catch (err) {
      console.error(JSON.stringify(tmcIdentProps, null, 4));
      throw err;
    }

    const getValuesForCols = getTmcIdentificationInsertValues.bind(
      null,
      tmcIdentProps,
      nonNullColumnsTracker,
    );

    const values = tmcIdentificationColumns.map(getValuesForCols);

    tmcIdentificationInsertStmt.run(values);
  }

  const alwaysNullColumns = tmcIdentificationColumns.filter(
    (c) => !nonNullColumnsTracker[c],
  );

  if (alwaysNullColumns.length) {
    handleAlwaysNullTmcIdentificationColumns(alwaysNullColumns);
  }
}

const prepareNpmrdsShapefileInsertStmt = (
  xdb: Database,
  npmrdsShapefileColumns: string[],
) =>
  xdb.prepare(
    `
      INSERT INTO ${SCHEMA}.npmrds_shapefile(
        ${npmrdsShapefileColumns}
      ) VALUES(${npmrdsShapefileColumns.map((c) =>
        c === 'feature' ? 'json(?)' : '?',
      )}) ;
    `,
  );

const prepareNpmrdsShapefileGeopolyInsertStmt = (xdb: Database) =>
  xdb.prepare(
    `
      INSERT INTO ${SCHEMA}.npmrds_shapefile_geopoly_idx (
        _shape,
        tmc
      ) VALUES (?, ?) ;
    `,
  );

const getNpmrdsShapefileInsertValues = (
  feature: NpmrdsShapefileFeature,
  nonNullColumnsTracker: Record<string, boolean>,
  c: string,
) => {
  let v: any = null;
  if (c === 'feature') {
    const f: any = { ...feature };
    const {
      properties: { tmc },
    } = feature;

    f.properties = { tmc };

    f.id = tmc;

    v = JSON.stringify(f);
  } else {
    v = feature.properties[c];
    if (_.isNil(v) || v === '') {
      v = null;
    }
  }

  // eslint-disable-next-line no-param-reassign
  nonNullColumnsTracker[c] = nonNullColumnsTracker[c] || v !== null;

  return v;
};

const compareNpmrdsShapefileSchemas = (
  npmrdsShapefileColumns: readonly string[],
  properties: Record<string, string | number | null>,
) => {
  const disregardedShapefileProps = new Set([
    'oid',
    'mvversioni',
    'startlat',
    'startlong',
    'endlat',
    'endlong',
    'miles',
  ]);
  const inputProps = Object.keys(properties).reduce((acc, p) => {
    if (!disregardedShapefileProps.has(p)) {
      acc[p] = properties[p];
    }

    return acc;
  }, {});

  const diff = compareSchemas(npmrdsShapefileColumns, inputProps);

  if (diff) {
    const { dbOnly, inputOnly } = diff;
    handleNpmrdsShapefileInputDataSchemaInconsistency(dbOnly, inputOnly);
  }
};

async function loadNpmrdsShapefile(
  xdb: any,
  npmrdsShapefileIterator: NpmrdsShapefileIterator,
) {
  const npmrdsShapefileColumns: string[] = xdb
    .pragma("table_info('npmrds_shapefile')")
    .map(({ name }) => name);

  const npmrdsShapefileInsertStmt = prepareNpmrdsShapefileInsertStmt(
    xdb,
    npmrdsShapefileColumns,
  );

  const npmrdsShapefileGeopolyInsertStmt = prepareNpmrdsShapefileGeopolyInsertStmt(
    xdb,
  );

  const nonNullColumnsTracker = npmrdsShapefileColumns.reduce((acc, c) => {
    acc[c] = false;
    return acc;
  }, {});

  let comparedSchemas = false;
  // eslint-disable-next-line no-restricted-syntax
  for await (const feature of npmrdsShapefileIterator) {
    if (!comparedSchemas) {
      compareNpmrdsShapefileSchemas(npmrdsShapefileColumns, feature.properties);
      comparedSchemas = true;
    }

    try {
      validateNpmrdsShapefileFeature(feature);
    } catch (err) {
      console.error(JSON.stringify(feature, null, 4));
      throw err;
    }

    const getValuesForCols = getNpmrdsShapefileInsertValues.bind(
      null,
      feature,
      nonNullColumnsTracker,
    );

    const values = npmrdsShapefileColumns.map(getValuesForCols);

    npmrdsShapefileInsertStmt.run(values);

    // Coordinates of the feature's bounding polygon.
    const polyCoords = getBufferPolygonCoords(feature);

    if (polyCoords.length !== 1) {
      handleTmcGeometryIrregularBoundingPolygon(feature);
    }

    // Inserts only the first set of coordinates.
    // If this INSERT fails, the database is corrupted.
    //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
    npmrdsShapefileGeopolyInsertStmt.run([
      JSON.stringify(_.first(polyCoords)),
      feature.id,
    ]);
  }

  const alwaysNullColumns = npmrdsShapefileColumns.filter(
    (c) => !nonNullColumnsTracker[c],
  );

  if (alwaysNullColumns.length) {
    handleAlwaysNullNpmrdsShapefileColumns(alwaysNullColumns);
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
