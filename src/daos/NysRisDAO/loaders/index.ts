import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database } from 'better-sqlite3';
import db from '../../../services/DbService';

import getBufferPolygonCoords from '../../../utils/getBufferPolygonCoords';

import { NYS_RIS as SCHEMA } from '../../../constants/databaseSchemaNames';

import {
  handleNysRisGeometryIrregularBoundingPolygon,
  handleInputDataSchemaInconsistency,
  handleAlwaysNullColumns,
} from './anomalyHandlers';

import {
  NysRoadInventorySystemProperties,
  NysRoadInventorySystemPropertiesValidator,
} from '../typing';

export type NysRoadInventorySystemGeodatabaseEntry = {
  properties: NysRoadInventorySystemProperties;
  shape: turf.Feature<turf.LineString | turf.MultiLineString> | null;
};

export interface NysRoadInventorySystemGeodatabaseEntryIterator
  extends Generator<NysRoadInventorySystemGeodatabaseEntry, void, unknown> {}

const preparedStmts = {};
const prepareStatement = (xdb: Database, stmt: string) => {
  let prepStmt = preparedStmts[stmt];

  if (!_.isNil(prepStmt)) {
    return prepStmt;
  }

  prepStmt = xdb.prepare(stmt);

  preparedStmts[stmt] = prepStmt;

  return prepStmt;
};

const createNysRisTables = (xdb: any) => {
  const sql = readFileSync(join(__dirname, './create_nys_ris_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  xdb.exec(sql);
};

const compareSchemas = (
  nysRisTableColumns: string[],
  properties: NysRoadInventorySystemProperties,
) => {
  const inputProps = Object.keys(properties);

  const dbCols = _(nysRisTableColumns)
    .omit(['feature', '"primary"'])
    .push('primary')
    .value();

  const dbOnly = _.difference(dbCols, inputProps);
  const inputOnly = _.difference(inputProps, dbCols);

  if (dbOnly.length > 0 || inputOnly.length > 0) {
    handleInputDataSchemaInconsistency(dbOnly, inputOnly);
  }
};

const loadNysRisGeodatabase = (
  xdb: any,
  geodatabaseEntriesIterator: NysRoadInventorySystemGeodatabaseEntryIterator,
) => {
  const nysRisTableColumns: string[] = xdb
    .pragma("table_info('nys_ris')")
    .map(({ name }) => (name === 'primary' ? '"primary"' : name));

  const nonNullColumnsTracker = nysRisTableColumns.reduce((acc, c) => {
    acc[c] = false;
    return acc;
  }, {});

  const getInsertValues = (
    entry: NysRoadInventorySystemGeodatabaseEntry,
    c: string,
  ) => {
    const { properties, shape } = entry;

    // '"primary"' requires cleaning the double quotes
    const k = c === '"primary"' ? 'primary' : c;

    let v = k === 'feature' ? shape && JSON.stringify(shape) : properties[k];

    if (_.isNil(v) || v === '') {
      v = null;
    }

    nonNullColumnsTracker[c] = nonNullColumnsTracker[c] || v !== null;

    return v;
  };

  let comparedSchemas = false;
  // eslint-disable-next-line no-restricted-syntax
  for (const entry of geodatabaseEntriesIterator) {
    const { properties, shape = null } = entry;

    if (!comparedSchemas) {
      compareSchemas(nysRisTableColumns, properties);
      comparedSchemas = true;
    }

    const metadata = _.mapValues(properties, (v) =>
      _.isNil(v) || v === '' ? null : v,
    );

    if (!NysRoadInventorySystemPropertiesValidator(metadata)) {
      console.log(
        JSON.stringify(
          NysRoadInventorySystemPropertiesValidator.errors,
          null,
          4,
        ),
      );
      console.log(JSON.stringify({ properties, metadata }, null, 4));
      throw new Error('Invalid NYS RIS Geodatabase entry.');
    }

    const values = nysRisTableColumns.map(getInsertValues.bind(null, entry));

    prepareStatement(
      xdb,
      `
        INSERT INTO ${SCHEMA}.nys_ris (
          ${nysRisTableColumns}
        ) VALUES(${nysRisTableColumns.map(() => '?')}) ;
      `,
    ).run(values);

    if (shape) {
      // Coordinates of the feature's bounding polygon.
      const polyCoords = getBufferPolygonCoords(shape);

      if (polyCoords.length !== 1) {
        handleNysRisGeometryIrregularBoundingPolygon(shape);
      }

      // Inserts only the first set of coordinates.
      // If this INSERT fails, the database is corrupted.
      //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
      prepareStatement(
        xdb,
        `
          INSERT INTO ${SCHEMA}.nys_ris_geopoly_idx (
            _shape,
            fid
          ) VALUES (json(?), ?) ;
        `,
      ).run([JSON.stringify(_.first(polyCoords)), shape.id]);
    }
  }

  const alwaysNullColumns = nysRisTableColumns.filter(
    (c) => !nonNullColumnsTracker[c],
  );

  if (alwaysNullColumns.length) {
    handleAlwaysNullColumns(alwaysNullColumns);
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
    xdb.exec(`VACUUM ${SCHEMA};`);
    db.closeLoadingConnectionToDb(xdb);
  }
}
