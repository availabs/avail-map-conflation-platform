/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database as SqliteDatabase } from 'better-sqlite3';

import DbService from '../../../../services/DbService';

import logger from '../../../../services/Logger';

import getGtfsAgencyOutputDir from '../../utils/getGtfsAgencyOutputDir';

import { GtfsAgencyName, GtfsTable } from '../../domain/types';

export type CsvRow = Record<string, number | string | null>;

export type AsyncCsvRowGenerator = AsyncGenerator<CsvRow>;

function createGtfsTables(db: SqliteDatabase) {
  const sql = readFileSync(join(__dirname, './sql/create_gtfs_tables.sql'), {
    encoding: 'utf8',
  });

  db.exec(sql);
}

// Inserting integers into TEXT columns appends decimal portion.
//   This function prevents that.
//   See: https://github.com/JoshuaWise/better-sqlite3/issues/309#issuecomment-539694993
const formatRowForSqliteInsert = (
  columnsList: string[],
  row: Record<string, string | number | null>,
) =>
  columnsList.map((col) =>
    _.isNil(row[col]) || row[col] === '' ? null : `${row[col]}`,
  );

function checkTripsForShapes(db: SqliteDatabase) {
  const [totalTrips, tripsWithoutShapes] = db
    .prepare(
      `
        SELECT
            *
          FROM (
            SELECT
                COUNT(1) AS total_trips
              FROM gtfs.trips
          ) CROSS JOIN (
            SELECT
                COUNT(1) AS shapeless_trips
              FROM gtfs.trips
              WHERE (shape_id IS NULL)
          ) ;
      `,
    )
    .raw()
    .get();

  if (tripsWithoutShapes > 0) {
    const msg = `
      WARNING:

        The GTFS trips file contains ${tripsWithoutShapes} trips without shapes
          out of ${totalTrips} total trips.

         The trips.shape_id column is optional per the GTFS specification,
           however the GTFS conflation pipeline does not currently support such trips.

         They will be excluded from the AADT counts.
    `;

    logger.warn(msg);
  }
}

async function loadAsync(
  db: SqliteDatabase,
  tableName: GtfsTable,
  rowAsyncIterator: AsyncCsvRowGenerator,
) {
  const columnsList = _.flatten(
    db
      .prepare(
        `
          SELECT
              name
            FROM gtfs.pragma_table_info('${tableName}')
            ORDER BY cid ;
        `,
      )
      .raw()
      .all(),
  );

  const insertRowStmt = db.prepare(`
    INSERT INTO gtfs.${tableName} (${columnsList})
      VALUES (${columnsList.map(() => '?')});
  `);

  let rowCt = 0;

  for await (const row of rowAsyncIterator) {
    // TODO: Log warning if row has fields not in columns list
    insertRowStmt.run(formatRowForSqliteInsert(columnsList, row));
    ++rowCt;
  }

  if (tableName === 'trips') {
    checkTripsForShapes(db);
  }

  return rowCt;
}

export default async function loadGtfsZipArchive(
  gtfsAgencyName: GtfsAgencyName,
  gtfsFilesIterator: AsyncGenerator<{
    tableName: GtfsTable;
    ayncRowIterator: AsyncCsvRowGenerator;
  }>,
) {
  const gtfsAgencyOutputDir = getGtfsAgencyOutputDir(gtfsAgencyName);

  const db = DbService.openConnectionToDb('gtfs', gtfsAgencyOutputDir, 'gtfs');

  try {
    db.exec('BEGIN;');

    createGtfsTables(db);

    for await (const { tableName, ayncRowIterator } of gtfsFilesIterator) {
      await loadAsync(db, tableName, ayncRowIterator);
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');

    console.error(err);

    throw err;
  }
}
