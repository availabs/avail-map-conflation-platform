import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database } from 'better-sqlite3';
import db from '../../../../services/DbService';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  handleNysRisGeometryIrregularBoundingPolygon,
  handleNysRoadInventorySystemInputDataSchemaInconsistency,
  handleAlwaysNullNysRoadInventorySystemColumns,
} from './anomalyHandlers';

import {
  NysRoadInventorySystemProperties,
  validateNysRoadInventorySystemProperties,
} from '../domain';

export type NysRoadInventorySystemGeodatabaseEntry = {
  properties: NysRoadInventorySystemProperties;
  shape: turf.Feature<turf.LineString | turf.MultiLineString> | null;
};

export interface NysRoadInventorySystemGeodatabaseEntryIterator
  extends Generator<NysRoadInventorySystemGeodatabaseEntry, void, unknown> {}

const createNysRisTables = (xdb: any) => {
  const sql = readFileSync(join(__dirname, './create_nys_ris_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  xdb.exec(sql);
};

const compareSchemas = (
  nysRisTableColumns: readonly string[],
  properties: NysRoadInventorySystemProperties,
) => {
  const inputProps = Object.keys(properties);

  const dbCols = nysRisTableColumns.filter(
    (c) => c !== 'feature' && c !== '"primary"',
  );
  dbCols.push('primary');

  const dbOnly = _.difference(dbCols, inputProps);
  const inputOnly = _.difference(inputProps, dbCols);

  if (dbOnly.length > 0 || inputOnly.length > 0) {
    handleNysRoadInventorySystemInputDataSchemaInconsistency(dbOnly, inputOnly);
  }
};

const getColumnValueFromEntry = (
  entry: NysRoadInventorySystemGeodatabaseEntry,
  nonNullColumnsTracker: Record<string, boolean>,
  c: string,
) => {
  const { properties, shape } = entry;

  // '"primary"' requires cleaning the double quotes
  const k = c === '"primary"' ? 'primary' : c;

  let v = k === 'feature' ? shape && JSON.stringify(shape) : properties[k];

  if (_.isNil(v) || v === '') {
    v = null;
  }

  // eslint-disable-next-line no-param-reassign
  nonNullColumnsTracker[c] = nonNullColumnsTracker[c] || v !== null;

  return v;
};

const prepareInsertGdbEntryStmt = (
  xdb: Database,
  nysRisTableColumns: readonly string[],
) =>
  xdb.prepare(
    `
      INSERT INTO ${SCHEMA}.nys_ris (
        ${nysRisTableColumns}
      ) VALUES(${nysRisTableColumns.map((c) =>
        c === 'feature' ? 'json(?)' : ' ? ',
      )}) ;
    `,
  );

const prepareInsertGdbEntryMissingGeometryStmt = (xdb: Database) =>
  xdb.prepare(
    `
      INSERT INTO ${SCHEMA}._qa_nys_ris_entries_without_geometries (
        fid,
        properties
      ) VALUES(?, json(?));
    `,
  );

const prepareGeoPolyIdxStmt = (xdb: Database) =>
  xdb.prepare(
    `
      INSERT INTO ${SCHEMA}.nys_ris_geopoly_idx(
        _shape,
        fid
      ) VALUES(json(?), ?) ;
    `,
  );

const loadNysRisGeodatabase = (
  xdb: Database,
  geodatabaseEntriesIterator: NysRoadInventorySystemGeodatabaseEntryIterator,
) => {
  const nysRisTableColumns: readonly string[] = xdb
    .pragma("table_info('nys_ris')")
    .map(({ name }) => (name === 'primary' ? '"primary"' : name));

  const nonNullColumnsTracker = nysRisTableColumns.reduce((acc, c) => {
    acc[c] = false;
    return acc;
  }, {});

  const insertGdbEntryStmt = prepareInsertGdbEntryStmt(xdb, nysRisTableColumns);

  const updateGeoPolyIdxStmt = prepareGeoPolyIdxStmt(xdb);

  const insertGdbEntryMissingGeometryStmt = prepareInsertGdbEntryMissingGeometryStmt(
    xdb,
  );

  let comparedSchemas = false;
  // eslint-disable-next-line no-restricted-syntax
  for (const entry of geodatabaseEntriesIterator) {
    const { properties, shape = null } = entry;

    if (!comparedSchemas) {
      compareSchemas(nysRisTableColumns, properties);
      comparedSchemas = true;
    }

    // MUTATION: Set undefined or '' to NULL.
    Object.keys(properties).forEach((k) => {
      const v = properties[k];

      if (_.isNil(v) || v === '') {
        properties[k] = null;
      }
    });

    validateNysRoadInventorySystemProperties(properties);

    const getValuesForCols = getColumnValueFromEntry.bind(
      null,
      entry,
      nonNullColumnsTracker,
    );

    const values = nysRisTableColumns.map(getValuesForCols);

    // console.log(
    // JSON.stringify(
    // nysRisTableColumns.reduce((acc, k, i) => {
    // acc[k] = values[i];
    // return acc;
    // }, {}),
    // null,
    // 4,
    // ),
    // );

    insertGdbEntryStmt.run(values);

    if (shape) {
      // Coordinates of the feature's bounding polygon.
      const polyCoords = getBufferPolygonCoords(shape);

      if (polyCoords.length !== 1) {
        handleNysRisGeometryIrregularBoundingPolygon(shape);
      }

      // Inserts only the first set of coordinates.
      // If this INSERT fails, the database is corrupted.
      //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
      updateGeoPolyIdxStmt.run([JSON.stringify(_.first(polyCoords)), shape.id]);
    } else {
      insertGdbEntryMissingGeometryStmt.run([
        properties.fid,
        JSON.stringify(properties),
      ]);
    }
  }

  const alwaysNullColumns = nysRisTableColumns.filter(
    (c) => !nonNullColumnsTracker[c],
  );

  if (alwaysNullColumns.length) {
    handleAlwaysNullNysRoadInventorySystemColumns(alwaysNullColumns);
  }
};

// eslint-disable-next-line import/prefer-default-export
export async function loadNysRis(
  geodatabaseEntriesIterator: NysRoadInventorySystemGeodatabaseEntryIterator,
) {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    createNysRisTables(xdb);

    loadNysRisGeodatabase(xdb, geodatabaseEntriesIterator);

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    xdb.exec(`VACUUM ${SCHEMA}; `);
    db.closeLoadingConnectionToDb(xdb);
  }
}
