/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database } from 'better-sqlite3';

import TargetMapDAO from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import DbService from '../../../../services/DbService';

import { NYS_RIS } from '../../../../constants/databaseSchemaNames';

import {
  NysTrafficCountStationsVersion,
  TrafficCountStationYearDirection,
} from '../domain/types';

type TrafficCountStationStationYearDirectionAsyncIterator = AsyncGenerator<TrafficCountStationYearDirection>;

function createDbWriteConnection(): Database {
  const dbWriteConnection = DbService.openConnectionToDb(
    NYS_RIS,
    null,
    'nys_ris',
  );

  return dbWriteConnection;
}

function roadwayInventorySystemTableIsLoaded(db: Database) {
  const exists = !!db
    .prepare(
      `
        SELECT EXISTS(
          SELECT 1
            FROM nys_ris.sqlite_master
            WHERE(
              (type = 'table')
              AND
              (name = 'roadway_inventory_system')
            )
        ) ;
      `,
    )
    .pluck()
    .get();

  if (!exists) {
    return false;
  }

  const loaded = !!db
    .prepare(
      `
        SELECT EXISTS(
          SELECT 1
            FROM nys_ris.roadway_inventory_system
        );
      `,
    )
    .pluck()
    .get();

  return loaded;
}

const createTrafficCountStationYearDirectionsTables = (db: any) => {
  const sql = readFileSync(
    join(
      __dirname,
      './create_traffic_count_station_year_directions_tables.sql',
    ),
    {
      encoding: 'utf8',
    },
  );

  db.exec(sql);
};

async function bulkLoadTrafficCountStationStationYearDirectionsTable(
  db: Database,
  trafficCountStationYearDirectionAsyncIterator: TrafficCountStationStationYearDirectionAsyncIterator,
) {
  const insertTrafficCountStationYearDirectionStmt = db.prepare(
    `
      INSERT INTO nys_ris.nys_traffic_counts_station_year_directions(
        rc_station,
        year,
        federal_direction
      ) VALUES(?, ?, ?) ;
    `,
  );

  for await (const {
    rcStation,
    year,
    federalDirection,
  } of trafficCountStationYearDirectionAsyncIterator) {
    insertTrafficCountStationYearDirectionStmt.run([
      rcStation,
      year,
      federalDirection,
    ]);
  }
}

function getMaxTrafficCountYearFromNysRoadwayInventorySystemTable(
  db: Database,
) {
  return db
    .prepare(
      `
        SELECT
            MAX(last_actual_cntyr) AS max_yr
          FROM nys_ris.roadway_inventory_system ;
      `,
    )
    .pluck()
    .get();
}

function loadRisSegmentFederalDirections(db: Database) {
  const maxTrafficCountYear = getMaxTrafficCountYearFromNysRoadwayInventorySystemTable(
    db,
  );

  db.prepare(
    `
      INSERT INTO nys_ris.ris_segment_federal_directions (
        fid,
        rc_station,
        traffic_count_year,
        federal_directions
      )
        SELECT
            fid,
            rc_station,
            traffic_count_year,
            NULLIF(
              json_group_array(federal_direction),
              '[null]'
            ) AS federal_directions
          FROM (
            SELECT
                a.fid,
                b.rc_station,
                b.year AS traffic_count_year,
                b.federal_direction,
                rank() OVER (PARTITION BY rc_station ORDER BY year DESC) AS antecendency
              FROM nys_ris.roadway_inventory_system AS a
                LEFT OUTER JOIN nys_ris.nys_traffic_counts_station_year_directions AS b
                  ON (
                    ( substr(printf('0%d', a.region_co), -2)
                        || '_'
                        || substr(printf('0000%d', a.station_num), -4)
                    ) = b.rc_station
                  )
              WHERE ( b.year <= ${maxTrafficCountYear} )
              ORDER BY 1,2,3,4
          )
          WHERE ( antecendency = 1 )
          GROUP BY fid ;
    `,
  ).run();
}

export default async function loadNysTrafficCountStationsTables(
  nys_traffic_count_stations_version: NysTrafficCountStationsVersion,
  trafficCountStationStationYearDirectionAsyncIterator: TrafficCountStationStationYearDirectionAsyncIterator,
) {
  const db = createDbWriteConnection();

  if (!roadwayInventorySystemTableIsLoaded(db)) {
    throw new Error(
      'The roadway_inventory_system table must be loaded before the nys_traffic_counts_station_year_directions table.',
    );
  }

  db.exec('BEGIN;');

  createTrafficCountStationYearDirectionsTables(db);

  await bulkLoadTrafficCountStationStationYearDirectionsTable(
    db,
    trafficCountStationStationYearDirectionAsyncIterator,
  );

  loadRisSegmentFederalDirections(db);

  db.exec('COMMIT;');

  const targetMapDao = new TargetMapDAO(NYS_RIS);

  targetMapDao.setMetadataProperty(
    'nysTrafficCountStationsVersion',
    nys_traffic_count_stations_version,
  );
}
