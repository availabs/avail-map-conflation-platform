/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database } from 'better-sqlite3';
import DbService from '../../../../services/DbService';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import { NYS_RIS as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  handleNysRisGeometryIrregularBoundingPolygon,
  handleNysRoadInventorySystemInputDataSchemaInconsistency,
  handleAlwaysNullNysRoadInventorySystemColumns,
} from './anomalyHandlers';

import {
  NysRoadInventorySystemProperties,
  TrafficCountStationYearDirection,
  validateNysRoadInventorySystemProperties,
} from '../domain';

export type NysRoadInventorySystemGeodatabaseEntry = {
  properties: NysRoadInventorySystemProperties;
  shape: turf.Feature<turf.LineString | turf.MultiLineString> | null;
};

export interface NysRoadInventorySystemGeodatabaseEntryIterator
  extends Generator<NysRoadInventorySystemGeodatabaseEntry, void, unknown> {}

export type TrafficCountStationYearDirectionAsyncIterator = AsyncGenerator<TrafficCountStationYearDirection>;

const createNysRisTables = (db: any) => {
  const sql = readFileSync(join(__dirname, './create_nys_ris_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  db.exec(sql);
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
  db: Database,
  nysRisTableColumns: readonly string[],
) =>
  db.prepare(
    `
      INSERT INTO source_map.roadway_inventory_system (
        ${nysRisTableColumns}
      ) VALUES(${nysRisTableColumns.map((c) =>
        c === 'feature' ? 'json(?)' : ' ? ',
      )}) ;
    `,
  );

const prepareInsertGdbEntryMissingGeometryStmt = (db: Database) =>
  db.prepare(
    `
      INSERT INTO source_map._qa_nys_ris_entries_without_geometries (
        fid,
        properties
      ) VALUES(?, json(?));
    `,
  );

const prepareGeoPolyIdxStmt = (db: Database) =>
  db.prepare(
    `
      INSERT INTO source_map.nys_ris_geopoly_idx(
        _shape,
        fid
      ) VALUES(json(?), ?) ;
    `,
  );

const loadNysRisGeodatabase = (
  db: Database,
  geodatabaseEntriesIterator: NysRoadInventorySystemGeodatabaseEntryIterator,
) => {
  const nysRisTableColumns: readonly string[] = db
    .pragma("table_info('roadway_inventory_system')")
    .map(({ name }) => (name === 'primary' ? '"primary"' : name));

  const nonNullColumnsTracker = nysRisTableColumns.reduce((acc, c) => {
    acc[c] = false;
    return acc;
  }, {});

  const insertGdbEntryStmt = prepareInsertGdbEntryStmt(db, nysRisTableColumns);

  const updateGeoPolyIdxStmt = prepareGeoPolyIdxStmt(db);

  const insertGdbEntryMissingGeometryStmt = prepareInsertGdbEntryMissingGeometryStmt(
    db,
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

/* TODO: Move this to the final stage of the conflation pipeline.
         It is not used until then and loading it now introduces a unstable dependency
           in the early stages. If it remains here and the counts files change,
           the entire RIS conflation would need to be rerun.

async function loadTrafficCountStationYearDirectionsTable(
  db: Database,
  trafficCountStationYearDirectionAsyncIterator: TrafficCountStationYearDirectionAsyncIterator,
) {
  const insertStmt = db.prepare(`
    INSERT INTO source_map.nys_traffic_counts_station_year_directions(
      rc_station,
      year,
      federal_direction
    ) VALUES(?, ?, ?) ;
  `);

  for await (const {
    rcStation,
    year,
    federalDirection,
  } of trafficCountStationYearDirectionAsyncIterator) {
    insertStmt.run([rcStation, year, federalDirection]);
  }
}

function loadRisSegmentFederalDirections(db: Database, year: number) {
  // FIXME: Get year from select max(last_actual_cntyr) from roadway_inventory_system;
  db.prepare(
    `
        INSERT INTO source_map.ris_segment_federal_directions (
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
                FROM source_map.roadway_inventory_system AS a
                  LEFT OUTER JOIN source_map.nys_traffic_counts_station_year_directions AS b
                    ON (
                      ( substr(printf('0%d', a.region_co), -2)
                          || '_'
                          || substr(printf('0000%d', a.station_num), -4)
                      ) = b.rc_station
                    )
                WHERE ( b.year <= ? )
                ORDER BY 1,2,3,4
            )
            WHERE ( antecendency = 1 )
            GROUP BY fid ;
      `,
  ).run([year]);
}
*/

// eslint-disable-next-line import/prefer-default-export
export async function loadNysRis(
  geodatabaseEntriesIterator: NysRoadInventorySystemGeodatabaseEntryIterator,
) {
  const db = DbService.openConnectionToDb(SCHEMA, null, 'source_map');

  try {
    db.exec('BEGIN;');

    createNysRisTables(db);

    loadNysRisGeodatabase(db, geodatabaseEntriesIterator);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error(err);
    process.exit(1);
  } finally {
    db.exec(`VACUUM source_map; `);
    db.close();
  }
}
