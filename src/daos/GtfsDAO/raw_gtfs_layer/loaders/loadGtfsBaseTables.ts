/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database as SqliteDatabase } from 'better-sqlite3';

import DbService from '../../../../services/DbService';

import logger from '../../../../services/Logger';

import getGtfsAgencyOutputDir from '../../utils/getGtfsAgencyOutputDir';

import { GtfsAgencyName, GtfsTable } from '../../domain/types';

import createShapeLineString from './utils/createShapeLineString';
import makeGtfsShapeOsrmMatchesIterator from './utils/makeGtfsShapeOsrmMatchesIterator';

import GeoPackageWriter from '../../../../services/Conflation/developmentTools/conflationSpatial/utils/GeoPackageWriter';

export type CsvRow = Record<string, number | string | null>;

export type AsyncCsvRowGenerator = AsyncGenerator<CsvRow>;

enum TimePeriod {
  AMP = 'AMP',
  MIDD = 'MIDD',
  PMP = 'PMP',
  WE = 'WE',
  OVN = 'OVN',
}

function getSql(fileBasename: string) {
  return readFileSync(join(__dirname, `./sql/${fileBasename}.sql`), {
    encoding: 'utf8',
  });
}

// Inserting integers into TEXT columns appends decimal portion.
//   This function prevents that.
//   See: https://github.com/JoshuaWise/better-sqlite3/issues/309#issuecomment-539694993
const formatRowForSqliteInsert = (
  columnsList: string[],
  row: Record<string, string | number | null>,
): Array<string | null> =>
  columnsList.map((col) =>
    // Each column either stringified or null.
    _.isNil(row[col]) || row[col] === '' ? null : `${row[col]}`,
  );

function warnAboutShapelessTrips(dbWriteConnection: SqliteDatabase) {
  const [totalTrips, tripsWithoutShapes] = dbWriteConnection
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

// General purpose GTFS Feed file loader. Handles all files in the feed.
async function loadAsync(
  dbWriteConnection: SqliteDatabase,
  tableName: GtfsTable,
  rowAsyncIterator: AsyncCsvRowGenerator,
) {
  // Inspect the database schema to get the column names for this file's respective table.
  const columnsList = _.flatten(
    dbWriteConnection
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

  // Prepare the INSERT statement using the table's column names
  const insertRowStmt = dbWriteConnection.prepare(`
    INSERT INTO gtfs.${tableName} (${columnsList})
      VALUES (${columnsList.map(() => '?')});
  `);

  let rowCt = 0;

  // Load the CSV rows into the file's respective DB table.
  for await (const row of rowAsyncIterator) {
    // TODO: Add QA to make sure the GTFS CSV columns have standard names.
    insertRowStmt.run(formatRowForSqliteInsert(columnsList, row));
    ++rowCt;
  }

  // Some Trips may not have an associated GeoSpatial Shape.
  // Without a Shape, we cannot associate the trip with the road network.
  // We log a warning if there are any such Trips in the GTFS feed.
  if (tableName === 'trips') {
    warnAboutShapelessTrips(dbWriteConnection);
  }

  return rowCt;
}

// Load all files in the  GTFS Feed into their respective DB tables.
async function loadGtfsZipArchive(
  dbWriteConnection: SqliteDatabase,
  gtfsFilesIterator: AsyncGenerator<{
    tableName: GtfsTable;
    ayncRowIterator: AsyncCsvRowGenerator;
  }>,
) {
  const sql = getSql('create_gtfs_tables');

  //  Clean and Initialize the database tables that correspond 1-to-1
  //    with the GTFS Feed files.
  dbWriteConnection.exec(sql);

  // Load each file in the feed.
  for await (const { tableName, ayncRowIterator } of gtfsFilesIterator) {
    await loadAsync(dbWriteConnection, tableName, ayncRowIterator);
  }
}

function createGtfsScheduleViews(dbWriteConnection: SqliteDatabase) {
  const sql = getSql('create_schedule_tables');

  dbWriteConnection.exec(sql);
}

function createGtfsTripsServicesTable(dbWriteConnection: SqliteDatabase) {
  const sql = getSql('create_trips_services_table');

  dbWriteConnection.exec(sql);
}

function loadGtfsSpatialTables(dbWriteConnection: SqliteDatabase) {
  const sql = getSql('create_gtfs_spatial_tables');

  dbWriteConnection.exec(sql);
}

async function loadGtfsShapesOsrmMatchesTable(
  dbReadConnection: SqliteDatabase,
  dbWriteConnection: SqliteDatabase,
  matchedShstRefsWriter: GeoPackageWriter | undefined | null,
) {
  const matchesIter = makeGtfsShapeOsrmMatchesIterator(
    dbReadConnection,
    matchedShstRefsWriter,
  );

  dbWriteConnection.exec(`
    DROP TABLE IF EXISTS gtfs.shape_osrm_matches ;

    CREATE TABLE gtfs.shape_osrm_matches (
      shape_id            TEXT,
      shst_reference_id   TEXT,

      PRIMARY KEY (shape_id, shst_reference_id)
    ) WITHOUT ROWID ;
  `);

  const insertStmt = dbWriteConnection.prepare(`
    INSERT INTO gtfs.shape_osrm_matches (
      shape_id,
      shst_reference_id
    ) VALUES (?, ?) ;
  `);

  for await (const { shapeId, shstRefIds } of matchesIter) {
    if (shstRefIds !== null) {
      shstRefIds.forEach((shstRefId) => insertStmt.run([shapeId, shstRefId]));
    }
  }

  dbWriteConnection.exec(`
    CREATE INDEX gtfs.shape_osrm_matches_shst_ref_idx
      ON shape_osrm_matches (shst_reference_id) ;
  `);
}

function loadGtfsTripsToConflationMapIdsTable(
  dbWriteConnection: SqliteDatabase,
) {
  dbWriteConnection.exec(`
    DROP TABLE IF EXISTS gtfs.trip_conflation_map_ids ;

    CREATE TABLE gtfs.trip_conflation_map_ids (
      trip_id             TEXT,
      conflation_map_id   INTEGER,

      PRIMARY KEY (trip_id, conflation_map_id)
    ) WITHOUT ROWID;

    INSERT INTO gtfs.trip_conflation_map_ids (
      trip_id,
      conflation_map_id
    )
      SELECT
          b.trip_id,
          c.id AS conflation_map_id
        FROM gtfs.shape_osrm_matches AS a
          INNER JOIN gtfs.trips AS b
            USING (shape_id)
          INNER JOIN conflation_map.conflation_map_segments AS c
            ON ( a.shst_reference_id = c.shst) ;
  `);
}

function loadGtfsTripsToConflationMapBusCounts(
  dbWriteConnection: SqliteDatabase,
) {
  const getTimePeriodSubQuery = (timePeriod: TimePeriod) =>
    `
            SELECT
                a.conflation_map_id, 
                COALESCE(
                  d.route_short_name,
                  d.route_long_name
                ) AS route_name,
                SUM(trips_count) AS ${timePeriod}_ct
              FROM gtfs.trip_conflation_map_ids AS a
                INNER JOIN gtfs.trip_counts_by_time_period AS b
                  USING (trip_id)
                INNER JOIN gtfs.trips AS c
                  USING (trip_id)
                INNER JOIN gtfs.routes AS d
                  USING (route_id)
              WHERE ( b.time_period = '${timePeriod}' )
              GROUP BY conflation_map_id, route_name
    `;

  dbWriteConnection.exec(`
    DROP TABLE IF EXISTS gtfs.conflation_map_segments_bus_counts_by_route_by_peak ;

    CREATE TABLE gtfs.conflation_map_segments_bus_counts_by_route_by_peak (
      conflation_map_id           INTEGER NOT NULL,
      -- agency                      TEXT NOT NULL,
      route_name                  TEXT NOT NULL,
      amp_annualized_bus_ct       REAL,
      midd_annualized_bus_ct      REAL,
      pmp_annualized_bus_ct       REAL,
      we_annualized_bus_ct        REAL,
      ovn_annualized_bus_ct       REAL,

      -- PRIMARY KEY (conflation_map_id, agency, route_name)
      PRIMARY KEY (conflation_map_id, route_name)
    ) WITHOUT ROWID;

    INSERT INTO gtfs.conflation_map_segments_bus_counts_by_route_by_peak (
      conflation_map_id,
      -- agency,
      route_name,
      amp_annualized_bus_ct,
      midd_annualized_bus_ct,
      pmp_annualized_bus_ct,
      we_annualized_bus_ct,
      ovn_annualized_bus_ct
    )
      SELECT
          conflation_map_id,
          -- COALESCE(base.agency_name, '') AS agency_name,
          route_name,
          ROUND(
            COALESCE( a.${TimePeriod.AMP}_ct,  0 ) * (365.0 / base.num_days)
            , 3
          ) AS amp_annualized_bus_ct,
          ROUND(
            COALESCE( b.${TimePeriod.MIDD}_ct,  0 ) * (365.0 / base.num_days)
            , 3
          ) AS midd_annualized_bus_ct,
          ROUND(
            COALESCE( c.${TimePeriod.PMP}_ct,  0 ) * (365.0 / base.num_days)
            , 3
          ) AS pmp_annualized_bus_ct,
          ROUND(
            COALESCE( d.${TimePeriod.WE}_ct,  0 ) * (365.0 / base.num_days)
            , 3
          ) AS we_annualized_bus_ct,
          ROUND(
            COALESCE( e.${TimePeriod.OVN}_ct,  0 ) * (365.0 / base.num_days)
            , 3
          ) AS ovn_annualized_bus_ct
        FROM (
          -- Need to start with a complete base table for the subsequent LEFT OUTER JOINs.
          SELECT DISTINCT
              a.conflation_map_id,
              COALESCE(
                c.route_short_name,
                c.route_long_name
              ) AS route_name,
              -- d.agency_name,
              e.num_days
            FROM gtfs.trip_conflation_map_ids AS a
              INNER JOIN gtfs.trips AS b
                USING (trip_id)
              INNER JOIN gtfs.routes AS c
                USING (route_id)
              -- LEFT OUTER JOIN gtfs.agency AS d
              --   USING (agency_id)
              JOIN gtfs.feed_date_extent AS e

        ) AS base
          LEFT OUTER JOIN ( ${getTimePeriodSubQuery(TimePeriod.AMP)}  ) AS a
            USING (conflation_map_id, route_name)
          LEFT OUTER JOIN ( ${getTimePeriodSubQuery(TimePeriod.MIDD)} ) AS b
            USING (conflation_map_id, route_name)
          LEFT OUTER JOIN ( ${getTimePeriodSubQuery(TimePeriod.PMP)}  ) AS c
            USING (conflation_map_id, route_name)
          LEFT OUTER JOIN ( ${getTimePeriodSubQuery(TimePeriod.WE)}   ) AS d
            USING (conflation_map_id, route_name)
          LEFT OUTER JOIN ( ${getTimePeriodSubQuery(TimePeriod.OVN)}  ) AS e
            USING (conflation_map_id, route_name)
    ;
  
    DROP VIEW IF EXISTS gtfs.conflation_map_segments_bus_aadt_by_route_by_peak;

    CREATE VIEW gtfs.conflation_map_segments_bus_aadt_by_route_by_peak
      AS
        SELECT
            conflation_map_id,
            -- agency,
            route_name,
            ROUND( amp_annualized_bus_ct  / 365, 3 ) AS amp_bus_aadt,
            ROUND( midd_annualized_bus_ct / 365, 3 ) AS midd_bus_aadt,
            ROUND( pmp_annualized_bus_ct  / 365, 3 ) AS pmp_bus_aadt,
            ROUND( we_annualized_bus_ct   / 365, 3 ) AS we_bus_aadt,
            ROUND( ovn_annualized_bus_ct  / 365, 3 ) AS ovn_bus_aadt
          FROM conflation_map_segments_bus_counts_by_route_by_peak
    ;

    DROP VIEW IF EXISTS gtfs.conflation_map_segments_bus_aadt;

    CREATE VIEW gtfs.conflation_map_segments_bus_aadt
      AS
        SELECT
            conflation_map_id,
            -- agency,
            json_group_object(
              route_name,
              json_object(
                'am',    amp_bus_aadt,
                'off',   midd_bus_aadt,
                'pm',    pmp_bus_aadt,
                'wknd',  we_bus_aadt,
                'ovn',   ovn_bus_aadt
              )
            ) AS aadt_by_route
          FROM (
            SELECT
                conflation_map_id,
                -- agency,
                route_name,
                amp_bus_aadt,
                midd_bus_aadt,
                pmp_bus_aadt,
                we_bus_aadt,
                ovn_bus_aadt
              FROM conflation_map_segments_bus_aadt_by_route_by_peak

            UNION ALL

            SELECT
                *
              FROM (
                SELECT
                    conflation_map_id,
                    -- agency,
                    '_total_' AS route_name,
                    SUM( amp_bus_aadt )  AS amp_bus_aadt,
                    SUM( midd_bus_aadt ) AS midd_bus_aadt,
                    SUM( pmp_bus_aadt )  AS pmp_bus_aadt,
                    SUM( we_bus_aadt )   AS we_bus_aadt,
                    SUM( ovn_bus_aadt )  AS ovn_bus_aadt
                  FROM conflation_map_segments_bus_aadt_by_route_by_peak
                  -- GROUP BY conflation_map_id, agency
                  GROUP BY conflation_map_id
              )
          )
          GROUP BY conflation_map_id
    ;
  `);
}

export default async function loadGtfs(
  gtfsAgencyName: GtfsAgencyName,
  gtfsFilesIterator: AsyncGenerator<{
    tableName: GtfsTable;
    ayncRowIterator: AsyncCsvRowGenerator;
  }>,
) {
  const shapesWriter = new GeoPackageWriter(`${gtfsAgencyName}_shapes`);
  const selfIntxnsWriter = new GeoPackageWriter(
    `${gtfsAgencyName}_self-intersections`,
  );
  const matchedShstRefsWriter = new GeoPackageWriter(
    `${gtfsAgencyName}_shst_references`,
  );

  const gtfsAgencyOutputDir = getGtfsAgencyOutputDir(gtfsAgencyName);

  const dbReadConnection = DbService.openConnectionToDb(
    'gtfs',
    gtfsAgencyOutputDir,
    'gtfs',
  );

  const dbWriteConnection = DbService.openConnectionToDb(
    'gtfs',
    gtfsAgencyOutputDir,
    'gtfs',
  );

  dbWriteConnection.pragma('gtfs.journal_mode = WAL');

  DbService.attachDatabaseToConnection(dbWriteConnection, 'conflation_map');

  dbWriteConnection.function(
    'create_shape_linestring',
    { deterministic: true },
    (shapeId: string, shapeDataStr: string) =>
      JSON.stringify(
        createShapeLineString.call(
          { shapesWriter, selfIntxnsWriter },
          shapeId,
          shapeDataStr,
        ),
      ),
  );

  try {
    let step = `${gtfsAgencyName}: load zip archive`;

    dbWriteConnection.exec('BEGIN;');

    console.time(step);
    await loadGtfsZipArchive(dbWriteConnection, gtfsFilesIterator);
    console.timeEnd(step);

    step = `${gtfsAgencyName}: create spatial tables`;

    console.time(step);
    loadGtfsSpatialTables(dbWriteConnection);
    console.timeEnd(step);

    step = `${gtfsAgencyName}: create schedule tables`;

    console.time(step);
    createGtfsScheduleViews(dbWriteConnection);
    console.timeEnd(step);

    step = `${gtfsAgencyName}: create trips-services tables`;

    console.time(step);
    createGtfsTripsServicesTable(dbWriteConnection);
    console.timeEnd(step);

    // NOTE: Need two transactions because we need two DB connections.
    //       The read connection creates an GTFS-Shapes iterator to feed the Matcher
    //         while the write connection inserts the OsrmMatches into the DB.
    dbWriteConnection.exec('COMMIT;');

    dbWriteConnection.exec('BEGIN;');

    step = `${gtfsAgencyName}: shapes osrm matches`;

    // Do the OSM-GTFS Matching
    console.time(step);
    await loadGtfsShapesOsrmMatchesTable(
      dbReadConnection,
      dbWriteConnection,
      matchedShstRefsWriter,
    );
    console.timeEnd(step);

    step = `${gtfsAgencyName}: create conflation map join`;

    console.time(step);
    loadGtfsTripsToConflationMapIdsTable(dbWriteConnection);
    console.timeEnd(step);

    step = `${gtfsAgencyName}: created conflation map bus aadt`;

    console.time(step);
    loadGtfsTripsToConflationMapBusCounts(dbWriteConnection);
    console.timeEnd(step);

    dbWriteConnection.exec('COMMIT;');

    dbReadConnection.close();
    dbWriteConnection.close();

    const db = DbService.openConnectionToDb(
      'gtfs',
      gtfsAgencyOutputDir,
      'gtfs',
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        db.pragma('gtfs.journal_mode = DELETE');
        break;
      } catch (err) {
        console.error(err);
      }
    }
  } finally {
    shapesWriter.close();
    selfIntxnsWriter.close();
    matchedShstRefsWriter.close();
  }
}
