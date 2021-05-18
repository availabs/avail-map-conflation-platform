/* eslint-disable no-restricted-syntax, no-underscore-dangle */

import { readFileSync } from 'fs';

import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';
import { SharedStreetsReference } from 'sharedstreets-types';
import DbService from '../../../../services/DbService';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  handleSharedStreetsReferenceInsertFailure,
  handleEmptyLocationReferences,
  handleSharedStreetsLocationReferenceToGeoJsonFailure,
  handleLocationReferenceIrregularBoundingPolygon,
} from './anomalyHandlers';

export default class SharedStreetsReferenceLoader {
  protected dbWriteConnection: Database;

  protected readonly preparedWriteStatements!: {
    shstReferenceFeaturesOverlappingPolyStmt?: Statement;
    insertSharedStreetsReferenceLocationStmt?: Statement;
    insertSharedStreetsReferenceStmt?: Statement;
  };

  constructor() {
    this.dbWriteConnection = DbService.openConnectionToDb(SCHEMA, null, 'shst');

    this.preparedWriteStatements = {};
  }

  protected initializeDatabaseTables() {
    const ddl = readFileSync(
      join(__dirname, './sql/create_shst_reference_tables.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(ddl);
  }

  protected get updateLocationReferencesGeopolyIndexStmt(): Statement {
    this.preparedWriteStatements.shstReferenceFeaturesOverlappingPolyStmt =
      this.preparedWriteStatements.shstReferenceFeaturesOverlappingPolyStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_references_location_references_geopoly_idx (
          _shape,
          shst_reference_id,
          location_reference_idx
        ) VALUES (?, ?, ?) ;
      `);

    return this.preparedWriteStatements
      .shstReferenceFeaturesOverlappingPolyStmt;
  }

  protected updateLocationReferencesGeopolyIndex(
    shstReference: SharedStreetsReference,
    locationReferenceIdx: number,
    locationReferencePoint: turf.Feature<turf.Point>,
  ) {
    // Update the spatial index.
    if (locationReferencePoint !== null) {
      // Coordinates of the feature's bounding polygon.
      const polyCoords = getBufferPolygonCoords(locationReferencePoint);

      if (polyCoords.length !== 1) {
        handleLocationReferenceIrregularBoundingPolygon(
          shstReference,
          locationReferenceIdx,
        );
      }

      // If this INSERT fails, the database the DB is corrupted.
      //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
      this.updateLocationReferencesGeopolyIndexStmt.run([
        JSON.stringify(_.first(polyCoords)),
        shstReference.id,
        locationReferenceIdx,
      ]);
    }
  }

  protected get insertSharedStreetsReferenceLocationStmt(): Statement {
    this.preparedWriteStatements.insertSharedStreetsReferenceLocationStmt =
      this.preparedWriteStatements.insertSharedStreetsReferenceLocationStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_references_location_references(
            shst_reference_id,
            location_reference_idx,
            intersection_id,
            inbound_bearing,
            outbound_bearing,
            distance_to_next_ref,
            geojson_point
          ) VALUES(?, ?, ?, ?, ?, ?, ?) ;
      `);

    return this.preparedWriteStatements
      .insertSharedStreetsReferenceLocationStmt;
  }

  protected insertLocationReferences(shstReference: SharedStreetsReference) {
    const { id: shstReferenceId, locationReferences } = shstReference;

    if (_.isEmpty(locationReferences)) {
      handleEmptyLocationReferences(shstReference);
      return false;
    }

    for (
      let locationReferenceIdx = 0;
      locationReferenceIdx < locationReferences.length;
      ++locationReferenceIdx
    ) {
      const locationReference = locationReferences[locationReferenceIdx];

      const {
        intersectionId,
        lon,
        lat,
        inboundBearing,
        outboundBearing,
        distanceToNextRef,
      } = locationReference;

      let locationReferencePoint: turf.Feature<turf.Point> | null;

      try {
        locationReferencePoint = turf.point(
          [lon, lat],
          {},
          { id: `${shstReferenceId} | ${locationReferenceIdx}` },
        );

        if (_.isEmpty(locationReferencePoint?.geometry?.coordinates)) {
          throw new Error(
            'Empty SharedStreets LocationReference GeoJSON Point coordinates.',
          );
        }
      } catch (error) {
        handleSharedStreetsLocationReferenceToGeoJsonFailure(
          shstReference,
          locationReferenceIdx,
          error,
        );
        // Keep processing. Non-critical error.
        locationReferencePoint = null;
      }

      // If this INSERT fails, the database is corrupted.
      //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
      this.insertSharedStreetsReferenceLocationStmt.run([
        shstReferenceId,
        locationReferenceIdx,
        intersectionId,
        inboundBearing,
        outboundBearing,
        distanceToNextRef,
        locationReferencePoint && JSON.stringify(locationReferencePoint),
      ]);

      if (locationReferencePoint !== null) {
        this.updateLocationReferencesGeopolyIndex(
          shstReference,
          locationReferenceIdx,
          locationReferencePoint,
        );
      }
    }

    return true;
  }

  protected get insertSharedStreetsReferenceStmt(): Statement {
    this.preparedWriteStatements.insertSharedStreetsReferenceStmt =
      this.preparedWriteStatements.insertSharedStreetsReferenceStmt ||
      this.dbWriteConnection.prepare(`
          INSERT OR IGNORE INTO shst.shst_references(
            id,
            geometry_id,
            form_of_way
          ) VALUES(?, ?, ?) ;
      `);

    return this.preparedWriteStatements.insertSharedStreetsReferenceStmt;
  }

  protected loadSharedStreetsReference(shstReference: SharedStreetsReference) {
    const { id, geometryId, formOfWay } = shstReference;

    // If the id exists in the database, changes === 0.
    //   Otherwise, changes === 1.
    const { changes: success } = this.insertSharedStreetsReferenceStmt.run([
      id,
      geometryId,
      formOfWay,
    ]);

    if (!success) {
      handleSharedStreetsReferenceInsertFailure(
        this.dbWriteConnection,
        shstReference,
      );
      return false;
    }

    return this.insertLocationReferences(shstReference);
  }

  async bulkLoadShstReferencesAsync(
    shstReferenceIter: AsyncGenerator<SharedStreetsReference>,
  ) {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      this.initializeDatabaseTables();

      for await (const shstReference of shstReferenceIter) {
        this.loadSharedStreetsReference(shstReference);
      }

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      console.error(err.message);
      this.dbWriteConnection.exec('ROLLBACK');
      throw err;
    }
  }
}
