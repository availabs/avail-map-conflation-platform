/* eslint-disable no-restricted-syntax, no-underscore-dangle */

import { readFileSync } from 'fs';
import { join } from 'path';
import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';
import memoizeOne from 'memoize-one';

import { Database, Statement } from 'better-sqlite3';
import { SharedStreetsGeometry } from 'sharedstreets-types';
import DbService from '../../../../services/DbService';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import { SOURCE_MAP } from '../../../../constants/databaseSchemaNames';

import {
  handleSharedStreetsGeometryToGeoJsonFailure,
  handleShstGeometryInsertFailure,
  handleSharedStreetsGeometryIrregularBoundingPolygon,
} from './anomalyHandlers';

const getShstGeometryFeature = memoizeOne(
  (shstGeometry: SharedStreetsGeometry) => {
    const { id: shstGeometryId, lonlats } = shstGeometry;

    const shstGeometryCoords = _.chunk(lonlats, 2);

    try {
      const shstGeometryFeature = turf.lineString(
        shstGeometryCoords,
        {
          id: shstGeometryId,
        },
        { id: shstGeometryId },
      );

      if (_.isEmpty(shstGeometryFeature?.geometry?.coordinates)) {
        throw new Error(
          'Empty SharedStreetsGeometry GeoJSON LineString coordinates.',
        );
      }

      return shstGeometryFeature;
    } catch (err) {
      handleSharedStreetsGeometryToGeoJsonFailure(shstGeometry, err);
      return null;
    }
  },
);

export default class SharedStreetsGeometryLoader {
  protected dbWriteConnection: Database;

  protected readonly preparedWriteStatements!: {
    insertShstGeometryStmt?: Statement;
    updateGeometryGeopolyIndexStmt?: Statement;
  };

  constructor() {
    this.dbWriteConnection = DbService.openConnectionToDb(
      SOURCE_MAP,
      null,
      'shst',
    );

    this.preparedWriteStatements = {};
  }

  protected initializeDatabaseTables() {
    const ddl = readFileSync(
      join(__dirname, './sql/create_shst_geometry_tables.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(ddl);
  }

  protected get insertShstGeometryStmt(): Statement {
    this.preparedWriteStatements.insertShstGeometryStmt =
      this.preparedWriteStatements.insertShstGeometryStmt ||
      this.dbWriteConnection.prepare(`
        INSERT OR IGNORE INTO shst.shst_geometries (
          id,
          from_intersection_id,
          to_intersection_id,
          forward_reference_id,
          back_reference_id,
          road_class,
          geojson_linestring
        ) VALUES (?, ?, ?, ?, ?, ?, ?) ;
      `);

    return this.preparedWriteStatements.insertShstGeometryStmt;
  }

  protected get updateGeometryGeopolyIndexStmt(): Statement {
    this.preparedWriteStatements.updateGeometryGeopolyIndexStmt =
      this.preparedWriteStatements.updateGeometryGeopolyIndexStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_geometries_geopoly_idx (
          _shape,
          id
        ) VALUES (?, ?) ;
      `);

    return this.preparedWriteStatements.updateGeometryGeopolyIndexStmt;
  }

  protected insertShstGeometry(shstGeometry: SharedStreetsGeometry) {
    const {
      id: shstGeometryId,
      fromIntersectionId,
      toIntersectionId,
      forwardReferenceId,
      backReferenceId,
      roadClass,
    } = shstGeometry;

    const shstGeometryFeature = getShstGeometryFeature(shstGeometry);

    // If the shstGeometryId exists in the database, changes === 0.
    //   Otherwise, changes === 1.
    const { changes: success } = this.insertShstGeometryStmt.run([
      shstGeometryId,
      fromIntersectionId,
      toIntersectionId,
      forwardReferenceId,
      backReferenceId,
      roadClass,
      shstGeometryFeature && JSON.stringify(shstGeometryFeature),
    ]);

    if (!success) {
      handleShstGeometryInsertFailure(this.dbWriteConnection, shstGeometry);
      return false;
    }

    this.updateGeometryGeopolyIndex(shstGeometry, shstGeometryFeature);

    return true;
  }

  protected updateGeometryGeopolyIndex(
    shstGeometry: SharedStreetsGeometry,
    shstGeometryFeature: turf.Feature<turf.LineString> | null,
  ) {
    if (shstGeometryFeature !== null) {
      // Coordinates of the feature's bounding polygon.
      const polyCoords = getBufferPolygonCoords(shstGeometryFeature);

      if (polyCoords.length !== 1) {
        handleSharedStreetsGeometryIrregularBoundingPolygon(shstGeometry);
      }

      const geopolyShape = _.first(polyCoords);

      assert(
        Array.isArray(geopolyShape) &&
          geopolyShape.every(
            (coords) => Array.isArray(coords) && coords.length === 2,
          ) &&
          _.isEqual(geopolyShape[0], geopolyShape[geopolyShape.length - 1]),
      );

      // Inserts only the first set of coordinates.
      // If this INSERT fails, the database is corrupted.
      //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
      this.updateGeometryGeopolyIndexStmt.run([
        JSON.stringify(_.first(polyCoords)),
        shstGeometryFeature.id,
      ]);
    }
  }

  async bulkLoadShstGeometriesAsync(
    shstGeometryIter: AsyncGenerator<SharedStreetsGeometry>,
  ) {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      this.initializeDatabaseTables();

      for await (const shstGeometry of shstGeometryIter) {
        this.insertShstGeometry(shstGeometry);
      }

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      console.error(err.message);
      this.dbWriteConnection.exec('ROLLBACK');
      throw err;
    }
  }
}
