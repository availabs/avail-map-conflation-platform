/* eslint-disable no-restricted-syntax, no-underscore-dangle */

import { readFileSync } from 'fs';

import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';
import { SharedStreetsIntersection } from 'sharedstreets-types';
import DbService from '../../../../services/DbService';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  handleSharedStreetsIntersectionToGeoJsonFailure,
  handleShstIntersectionInsertFailure,
  handleSharedStreetsIntersectionIrregularBoundingPolygon,
  handleShstIntersectionReferenceInsertFailure,
} from './anomalyHandlers';

export default class SharedStreetsIntersectionLoader {
  protected dbWriteConnection: Database;

  protected readonly preparedWriteStatements!: {
    updateLocationIntersectionsGeopolyIndexStmt?: Statement;
    insertShstIntersectionStmt?: Statement;
    insertShstIntersectionInboundReferenceStmt?: Statement;
    insertShstIntersectionOutboundReferenceStmt?: Statement;
  };

  static createShstIntersectionPoint(
    shstIntersection: SharedStreetsIntersection,
  ) {
    const {
      id: shstIntersectionId,
      nodeId,
      lon,
      lat,
      inboundReferenceIds,
      outboundReferenceIds,
    } = shstIntersection;

    try {
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        return turf.point(
          [lon, lat],
          {
            id: shstIntersectionId,
            nodeId,
            inboundReferenceIds,
            outboundReferenceIds,
          },
          { id: shstIntersectionId },
        );
      }

      throw new Error('Invalid (lon, lat) for SharedStreetsIntersection.');
    } catch (err) {
      handleSharedStreetsIntersectionToGeoJsonFailure(shstIntersection, err);
      return null;
    }
  }

  static get shstIntersectionsTablesDDL() {
    return readFileSync(
      join(__dirname, './sql/create_shst_intersection_tables.sql'),
      {
        encoding: 'utf8',
      },
    );
  }

  constructor() {
    this.dbWriteConnection = DbService.openConnectionToDb(SCHEMA, null, 'shst');

    this.preparedWriteStatements = {};
  }

  protected initializeDatabaseTables() {
    this.dbWriteConnection.exec(
      SharedStreetsIntersectionLoader.shstIntersectionsTablesDDL,
    );
  }

  protected get updateLocationIntersectionsGeopolyIndexStmt(): Statement {
    this.preparedWriteStatements.updateLocationIntersectionsGeopolyIndexStmt =
      this.preparedWriteStatements
        .updateLocationIntersectionsGeopolyIndexStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_intersections_geopoly_idx (
          _shape,
          id
        ) VALUES (?, ?) ;
      `);

    return this.preparedWriteStatements
      .updateLocationIntersectionsGeopolyIndexStmt;
  }

  protected updateSpatialIndex(
    shstIntersection: SharedStreetsIntersection,
    shstIntersectionPoint: turf.Feature<turf.Point>,
  ) {
    // Coordinates of the feature's bounding polygon.
    const polyCoords = getBufferPolygonCoords(shstIntersectionPoint);

    if (polyCoords.length !== 1) {
      handleSharedStreetsIntersectionIrregularBoundingPolygon(shstIntersection);
    }

    // Inserts only the first set of coordinates.
    // If this INSERT fails, the database is corrupted.
    //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
    this.updateLocationIntersectionsGeopolyIndexStmt.run([
      JSON.stringify(_.first(polyCoords)),
      shstIntersection.id,
    ]);
  }

  protected get insertShstIntersectionStmt(): Statement {
    this.preparedWriteStatements.insertShstIntersectionStmt =
      this.preparedWriteStatements.insertShstIntersectionStmt ||
      this.dbWriteConnection.prepare(`
        INSERT OR IGNORE INTO shst.shst_intersections (
          id,
          node_id,
          geojson_point
        ) VALUES (?, ?, ?) ;
      `);

    return this.preparedWriteStatements.insertShstIntersectionStmt;
  }

  protected insertShstIntersection(
    shstIntersection: SharedStreetsIntersection,
  ) {
    const { id: shstIntersectionId, nodeId } = shstIntersection;
    const shstIntersectionPoint = SharedStreetsIntersectionLoader.createShstIntersectionPoint(
      shstIntersection,
    );

    // If the shstIntersectionId exists in the database, changes === 0.
    //   Otherwise, changes === 1.
    const { changes: success } = this.insertShstIntersectionStmt.run([
      shstIntersectionId,
      nodeId,
      shstIntersectionPoint && JSON.stringify(shstIntersectionPoint),
    ]);

    if (!success) {
      handleShstIntersectionInsertFailure(
        this.dbWriteConnection,
        shstIntersection,
      );
      return false;
    }

    if (shstIntersectionPoint !== null) {
      this.updateSpatialIndex(shstIntersection, shstIntersectionPoint);
    }

    return success;
  }

  protected get insertShstIntersectionInboundReferenceStmt(): Statement {
    this.preparedWriteStatements.insertShstIntersectionInboundReferenceStmt =
      this.preparedWriteStatements.insertShstIntersectionInboundReferenceStmt ||
      this.dbWriteConnection.prepare(`
        INSERT OR IGNORE INTO shst.shst_intersections_inbound_references (
          shst_intersection_id,
          shst_reference_id
        ) VALUES (?, ?) ;
      `);

    return this.preparedWriteStatements
      .insertShstIntersectionInboundReferenceStmt;
  }

  protected get insertShstIntersectionOutboundReferenceStmt(): Statement {
    this.preparedWriteStatements.insertShstIntersectionOutboundReferenceStmt =
      this.preparedWriteStatements
        .insertShstIntersectionOutboundReferenceStmt ||
      this.dbWriteConnection.prepare(`
        INSERT OR IGNORE INTO shst.shst_intersections_outbound_references (
          shst_intersection_id,
          shst_reference_id
        ) VALUES (?, ?) ;
      `);

    return this.preparedWriteStatements
      .insertShstIntersectionOutboundReferenceStmt;
  }

  protected insertIntersectionReferenceIds(
    referenceType: 'inbound' | 'outbound',
    shstIntersection: SharedStreetsIntersection,
  ) {
    const { id: shstIntersectionId } = shstIntersection;

    const shstReferenceIds: string[] | null = _.uniq(
      shstIntersection[`${referenceType}ReferenceIds`],
    );

    if (shstReferenceIds !== null) {
      const insertStmt =
        referenceType === 'inbound'
          ? this.insertShstIntersectionInboundReferenceStmt
          : this.insertShstIntersectionOutboundReferenceStmt;

      for (
        let referenceIndex = 0;
        referenceIndex < shstReferenceIds.length;
        ++referenceIndex
      ) {
        const shstReferenceId = shstReferenceIds[referenceIndex];

        const { changes: success } = insertStmt.run([
          shstIntersectionId,
          shstReferenceId,
        ]);

        if (!success) {
          handleShstIntersectionReferenceInsertFailure(
            shstIntersection,
            referenceType,
            referenceIndex,
          );
        }
      }
    }
  }

  protected insertIntersectionInboundReferenceIds(
    shstIntersection: SharedStreetsIntersection,
  ) {
    this.insertIntersectionReferenceIds('inbound', shstIntersection);
  }

  protected insertIntersectionOutboundReferenceIds(
    shstIntersection: SharedStreetsIntersection,
  ) {
    this.insertIntersectionReferenceIds('outbound', shstIntersection);
  }

  async bulkLoadShstIntersectionsAsync(
    shstIntersectionIter: AsyncGenerator<SharedStreetsIntersection>,
  ) {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      this.initializeDatabaseTables();

      for await (const shstIntersection of shstIntersectionIter) {
        this.insertShstIntersection(shstIntersection);

        this.insertIntersectionInboundReferenceIds(shstIntersection);
        this.insertIntersectionOutboundReferenceIds(shstIntersection);
      }

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      console.error(err.message);
      this.dbWriteConnection.exec('ROLLBACK');
      throw err;
    }
  }
}
