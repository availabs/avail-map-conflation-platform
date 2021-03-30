/* eslint-disable no-restricted-syntax, no-underscore-dangle */

// Massive violation of single responsibility principle.

/*
    FIXME:  This modules ASSUMES that the SQLite database file exists
            and that the database is already attached to it.

            Also, the DB connection management is vastly improved in the
              TargetMapSubnetConflationBlackboardDao.
            This module SHOULD implement the solution used there.
*/

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database, Statement } from 'better-sqlite3';
import * as turf from '@turf/turf';
import _ from 'lodash';

import { Position } from '@turf/turf';

import db from '../../services/DbService';

import getGeoProximityKey from '../getGeoProximityKey';

import lineMerge from '../gis/lineMerge';
import getBufferPolygonCoords from '../getBufferPolygonCoords';

const ascendingNumberComparator = (a: number, b: number) => a - b;

const initializeTargetMapDatabaseTemplateSql = readFileSync(
  join(__dirname, './initialize_target_map_database.sql'),
).toString();

export type TargetMapSchema = string;

export interface RawTargetMapFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  id: number | string;
}

export interface TargetMapEdgeFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  id: number;
  properties: turf.Feature['properties'];
  geometry: turf.LineString | turf.MultiLineString;
}
export type TargetMapEntityLabel = string;

export type PreloadedTargetMapNode = {
  lon: number;
  lat: number;
  properties?: Record<string, any> | null;
};

export type TargetMapNodeId = number;

export type TargetMapNode = PreloadedTargetMapNode & {
  id: TargetMapNodeId;
  labels: TargetMapEntityLabel[];
};

export type TargetMapEdgeId = number;
export type TargetMapId = number | string;

export type PreloadedTargetMapEdge = {
  startCoord: Position;
  endCoord: Position;
  properties: Record<string, any> & {
    targetMapId: TargetMapId;
    targetMapEdgeLength: number;
    isUnidirectional: boolean;
  };
  coordinates: [number, number][] | [number, number][][];
};

export type TargetMapEdge = {
  id: TargetMapEdgeId;
  properties: PreloadedTargetMapEdge['properties'];
  labels: TargetMapEntityLabel[];
};

export type TargetMapEdgesGeoproximityIterator = Generator<TargetMapEdgeFeature>;

export type PreloadedTargetMapPath = {
  properties?: Record<string, any> & {
    targetMapMesoId: string;
    targetMapPathBearing: number | null;
  };
  edgeIdSequence: TargetMapEdgeId[];
};

export type TargetMapPathId = number;

export type TargetMapPath = PreloadedTargetMapPath & {
  id: TargetMapPathId;
  // labels: TargetMapEntityLabel[];
};

export type TargetMapPathEdgeIdx = number;

export type TargetMapPathEdgeFeature = TargetMapEdgeFeature & {
  properties: {
    targetMapPathId: TargetMapPathId;
    targetMapPathIdx: number;
  };
};

export type TargetMapPathEdgeFeatures = TargetMapPathEdgeFeature[];

export type TargetMapMetadata = {
  targetMapIsCenterline?: boolean;
};

export type QueryPolygon = turf.Feature<turf.Polygon>;

const getEdgeIdsWhereClause = (n: number | null) =>
  n !== null && n > -1
    ? `WHERE ( edge_id IN (${new Array(n).fill('?')}) )`
    : '';

export default class TargetMapDAO<T extends RawTargetMapFeature> {
  readonly targetMapSchema: TargetMapSchema;

  private readonly dbReadConnection: Database;

  private readonly dbWriteConnection: Database;

  private readonly preparedReadStatements: {
    targetMapDatabaseIsInitializedStmt?: Statement;
    queryTargetMapMetadata?: Statement;
    tableIsCleanStmt?: Record<string, Statement>;
    allTargetMapPathIdsStmt?: Statement;
    targetMapIdsForEdgeIdsStmts?: Record<number, Statement>;
    edgeIdsForTargetMapIdsStmts?: Record<number, Statement>;
    allPathsTraversingEdgesStmt?: Record<number, Statement>;
    prepareTargetMapPathEdgesStmt?: Statement;
    rawEdgeFeaturesStmt?: Statement;
    allRawEdgeFeaturesStmt?: Statement;
    groupedRawEdgeFeaturesStmt?: Record<number, Record<number, Statement>>;
    targetMapEdgeFeaturesStmt?: Statement;
    targetMapEdgesOverlappingPolyStmt?: Statement;
  };

  private readonly preparedWriteStatements: {
    updateTargetMapMetadata?: Statement;
    truncateTableStatements?: Record<string, Statement>;
    setTargetMapIsCenterlineStmt?: Statement;
    insertNodeStmt?: Statement;
    insertEdgeStmt?: Statement;
    insertEdgeGeopolyStmt?: Statement;
    insertPathStmt?: Statement;
    insertPathEdgeStmt?: Statement;
    insertPathLabelStmt?: Statement;
    updatePathPropertiesStmt?: Statement;
    deleteAllPathsWithLabelStmt?: Statement;
  };

  constructor(targetMapSchema: TargetMapSchema) {
    this.targetMapSchema = targetMapSchema;

    this.dbReadConnection = db.openConnectionToDb(this.targetMapSchema);
    this.dbWriteConnection = db.openConnectionToDb(this.targetMapSchema);

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};

    if (!this.targetMapDatabaseIsInitialized) {
      this.initializeTargetMapDatabase();
    }
  }

  closeConnections() {
    this.dbReadConnection.close();
    this.dbWriteConnection.close();
  }

  private get targetMapDatabaseIsInitializedStmt(): Statement {
    this.preparedReadStatements.targetMapDatabaseIsInitializedStmt =
      this.preparedReadStatements.targetMapDatabaseIsInitializedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT 1
              FROM ${this.targetMapSchema}.sqlite_master
              WHERE (
                ( type = 'table' )
                AND
                ( name = 'target_map_metadata' )
              )
          );
        `,
      );

    // @ts-ignore
    return this.preparedReadStatements.targetMapDatabaseIsInitializedStmt;
  }

  get targetMapDatabaseIsInitialized() {
    return this.targetMapDatabaseIsInitializedStmt.raw().get()[0] === 1;
  }

  /**
   * WARNING: Drops all existing tables in the TargetMapDatabase.
   */
  private initializeTargetMapDatabase() {
    const sql = initializeTargetMapDatabaseTemplateSql.replace(
      /__SCHEMA__/g,
      this.targetMapSchema,
    );

    this.dbWriteConnection.exec(sql);
  }

  private get queryTargetMapMetadata(): Statement {
    if (!this.preparedReadStatements.queryTargetMapMetadata) {
      this.preparedReadStatements.queryTargetMapMetadata = this.dbReadConnection.prepare(
        `
          SELECT
              metadata
            FROM ${this.targetMapSchema}.target_map_metadata ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.queryTargetMapMetadata;
  }

  get targetMapIsCenterline() {
    const targetMapMetadata = JSON.parse(
      this.queryTargetMapMetadata.raw().get()[0],
    );

    return !!targetMapMetadata.targetMapIsCenterline;
  }

  set targetMapIsCenterline(targetMapIsCenterline: boolean) {
    this.updateTargetMapMetadataStmt.run([
      'targetMapIsCenterline',
      JSON.stringify(targetMapIsCenterline),
    ]);
  }

  get mapYear() {
    const targetMapMetadata = JSON.parse(
      this.queryTargetMapMetadata.raw().get()[0],
    );

    return +targetMapMetadata.year ?? null;
  }

  set mapYear(year: number) {
    this.updateTargetMapMetadataStmt.run(['year', JSON.stringify(year)]);
  }

  // https://en.wikipedia.org/wiki/Eulerian_path
  get targetMapPathsAreEulerian() {
    const targetMapMetadata = JSON.parse(
      this.queryTargetMapMetadata.raw().get()[0],
    );

    return !!targetMapMetadata.targetMapPathsAreEulerian;
  }

  // Should be TRUE for NPMRDS & NYS_RIS, false for GTFS.
  set targetMapPathsAreEulerian(targetMapPathsAreEulerian: boolean) {
    this.updateTargetMapMetadataStmt.run([
      'targetMapPathsAreEulerian',
      JSON.stringify(targetMapPathsAreEulerian),
    ]);
  }

  private get updateTargetMapMetadataStmt(): Statement {
    if (!this.preparedWriteStatements.updateTargetMapMetadata) {
      this.preparedWriteStatements.updateTargetMapMetadata = this.dbWriteConnection.prepare(
        `
          UPDATE ${this.targetMapSchema}.target_map_metadata
            SET metadata = json_set(metadata, '$.' || ?, json(?))
        `,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.updateTargetMapMetadata;
  }

  private get insertNodeStmt(): Statement {
    if (!this.preparedWriteStatements.insertNodeStmt) {
      this.preparedWriteStatements.insertNodeStmt = this.dbWriteConnection.prepare(
        `
          INSERT OR IGNORE INTO ${this.targetMapSchema}.target_map_ppg_nodes (
            lon,
            lat,
            properties
          )
            VALUES(?, ?, json(?)) ; `,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertNodeStmt;
  }

  insertNode({
    lon,
    lat,
    properties = null,
  }: PreloadedTargetMapNode): TargetMapNodeId | null {
    const { changes, lastInsertRowid } = this.insertNodeStmt?.run([
      lon,
      lat,
      properties && JSON.stringify(properties),
    ]);

    if (changes === 0) {
      return null;
    }

    const nodeId = +lastInsertRowid;

    return nodeId;
  }

  private get insertEdgeStmt(): Statement {
    if (!this.preparedWriteStatements.insertEdgeStmt) {
      this.preparedWriteStatements.insertEdgeStmt = this.dbWriteConnection.prepare(
        `
          INSERT INTO ${this.targetMapSchema}.target_map_ppg_edges (
            from_node_id,
            to_node_id,
            geoprox_key,
            properties,
            coordinates
          )
            SELECT
                a.node_id AS from_node_id,
                b.node_id AS to_node_id,
                ? AS geoprox_key,
                json(?) AS properties,
                json(?) AS coordinates
              FROM ${this.targetMapSchema}.target_map_ppg_nodes AS a
                CROSS JOIN ${this.targetMapSchema}.target_map_ppg_nodes AS b
              WHERE (
                (
                  ( a.lon = ? )
                  AND
                  ( a.lat = ? )
                )
                AND
                (
                  ( b.lon = ? )
                  AND
                  ( b.lat = ? )
                )
              ) ;`,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertEdgeStmt;
  }

  private get insertEdgeGeopolyStmt(): Statement {
    if (!this.preparedWriteStatements.insertEdgeGeopolyStmt) {
      this.preparedWriteStatements.insertEdgeGeopolyStmt = this.dbWriteConnection.prepare(
        `
          INSERT INTO ${this.targetMapSchema}.target_map_ppg_edges_geopoly_idx (
            _shape,
            edge_id
          ) VALUES (json(?), ?) ;`,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertEdgeGeopolyStmt;
  }

  insertEdge({
    startCoord: [startLon, startLat],
    endCoord: [endLon, endLat],
    properties,
    coordinates,
  }: PreloadedTargetMapEdge): TargetMapEdgeId | null {
    try {
      const geoproxKey = getGeoProximityKey(coordinates);

      const { changes, lastInsertRowid } = this.insertEdgeStmt.run([
        geoproxKey,
        JSON.stringify(properties),
        JSON.stringify(coordinates),
        startLon,
        startLat,
        endLon,
        endLat,
      ]);

      if (changes === 0) {
        return null;
      }

      const edgeId = +lastInsertRowid;

      // Coordinates of the feature's bounding polygon.
      // @ts-ignore
      const feature = Array.isArray(coordinates?.[0]?.[0])
        ? // @ts-ignore
          turf.multiLineString(coordinates)
        : // @ts-ignore
          turf.lineString(coordinates);

      const polyCoords = getBufferPolygonCoords(feature);

      const geopolyShape = _.first(polyCoords);

      this.insertEdgeGeopolyStmt.run([JSON.stringify(geopolyShape), edgeId]);

      return edgeId;
    } catch (err) {
      console.error(
        JSON.stringify(
          {
            startCoord: [startLon, startLat],
            endCoord: [endLon, endLat],
            properties,
            coordinates,
          },
          null,
          4,
        ),
      );
      throw err;
    }
  }

  // The rawEdgeIsUnidirectional function is called for each RawTargetMapFeature to determine
  //   whether the Feature represents a uni-directional or bi-directional segment of road.
  private *makePreloadedTargetMapEdgesIterator(
    rawEdgeIsUnidirectional: (feature: T) => boolean,
  ): Generator<PreloadedTargetMapEdge> {
    const rawEdgesIter = this.makeRawEdgeFeaturesIterator();

    // Cannot do in database using SQL because we need to compute GeoProx keys
    //   The alternative it to iterate over the table while simultaneously mutating it.
    for (const feature of rawEdgesIter) {
      const { id: targetMapId } = feature;

      const isUnidirectional = rawEdgeIsUnidirectional(feature);

      const mergedLineStrings = lineMerge(feature).sort(
        (a, b) => turf.length(b) - turf.length(a),
      );

      const [longestLineString] = mergedLineStrings;

      const longestLineStringCoords = turf.getCoords(longestLineString);
      const [start_longitude, start_latitude] = longestLineStringCoords[0];
      const [end_longitude, end_latitude] = longestLineStringCoords[
        longestLineStringCoords.length - 1
      ];

      const properties = { targetMapId, isUnidirectional };

      const startCoord: turf.Position = [start_longitude, start_latitude];
      const endCoord: turf.Position = [end_longitude, end_latitude];

      const coordinates =
        mergedLineStrings.length === 1
          ? longestLineStringCoords
          : mergedLineStrings.map((f) => turf.getCoords(f));

      yield {
        startCoord,
        endCoord,
        properties,
        coordinates,
      };
    }
  }

  // The rawEdgeIsUnidirectional function is called for each RawTargetMapFeature to determine
  //   whether the Feature represents a uni-directional or bi-directional segment of road.
  loadMicroLevel(
    clean: boolean = true,
    rawEdgeIsUnidirectional: (feature: T) => boolean,
  ) {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      if (clean) {
        this.initializeTargetMapDatabase();
      }

      const edgesIterator = this.makePreloadedTargetMapEdgesIterator(
        rawEdgeIsUnidirectional,
      );

      for (const edge of edgesIterator) {
        console.log(edge.properties.targetMapId);

        const feature = Array.isArray(edge.coordinates[0][0])
          ? // @ts-ignore
            turf.multiLineString(edge.coordinates)
          : // @ts-ignore
            turf.lineString(edge.coordinates);

        edge.properties.targetMapEdgeLength = turf.length(feature);

        const {
          startCoord: [startLon, startLat],
          endCoord: [endLon, endLat],
        } = edge;

        this.insertNode({
          lon: startLon,
          lat: startLat,
          properties: null,
        });

        this.insertNode({
          lon: endLon,
          lat: endLat,
          properties: null,
        });

        this.insertEdge(edge);
      }

      this.dbWriteConnection.exec('COMMIT');
    } catch (err) {
      this.dbWriteConnection.exec('ROLLBACK;');
      console.error(err);
      throw err;
    }
  }

  private get insertPathStmt(): Statement {
    if (!this.preparedWriteStatements.insertPathStmt) {
      this.preparedWriteStatements.insertPathStmt = this.dbWriteConnection.prepare(
        `
          INSERT INTO ${this.targetMapSchema}.target_map_ppg_paths (
              properties
            ) VALUES (json(?)) ;`,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertPathStmt;
  }

  private get insertPathEdgeStmt(): Statement {
    this.preparedWriteStatements.insertPathEdgeStmt =
      this.preparedWriteStatements.insertPathEdgeStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO ${this.targetMapSchema}.target_map_ppg_path_edges (
            path_id,
            path_edge_idx,
            edge_id
          ) VALUES (?, ?, ?) ;`,
      );

    // @ts-ignore
    return this.preparedWriteStatements.insertPathEdgeStmt;
  }

  insertPath({
    edgeIdSequence,
    properties,
  }: PreloadedTargetMapPath): TargetMapPathId | null {
    this.dbWriteConnection.exec('SAVEPOINT insert_path;');

    const { changes, lastInsertRowid } = this.insertPathStmt.run([
      properties && JSON.stringify(properties),
    ]);

    if (changes === 0) {
      return null;
    }

    const pathId = +lastInsertRowid;

    try {
      for (let pathIdx = 0; pathIdx < edgeIdSequence.length; ++pathIdx) {
        const edgeId = edgeIdSequence[pathIdx];

        this.insertPathEdgeStmt.run([pathId, pathIdx, edgeId]);
      }

      this.dbWriteConnection.exec('RELEASE SAVEPOINT insert_path;');
    } catch (err) {
      this.dbWriteConnection.exec(
        'ROLLBACK TRANSACTION TO SAVEPOINT insert_path;',
      );

      console.error(JSON.stringify({ properties, edgeIdSequence }, null, 4));
      throw err;
    }

    return pathId;
  }

  private get insertPathLabelStmt(): Statement {
    if (!this.preparedWriteStatements.insertPathLabelStmt) {
      this.preparedWriteStatements.insertPathLabelStmt = this.dbWriteConnection.prepare(
        `
          INSERT OR IGNORE INTO ${this.targetMapSchema}.target_map_ppg_path_labels (
            path_id,
            label
          ) VALUES (?, ?) ;`,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertPathLabelStmt;
  }

  insertPathLabel({
    pathId,
    label,
  }: {
    pathId: TargetMapPathId;
    label: TargetMapEntityLabel;
  }) {
    this.insertPathLabelStmt.run([pathId, label]);
  }

  private get updatePathPropertiesStmt(): Statement {
    this.preparedWriteStatements.updatePathPropertiesStmt =
      this.preparedWriteStatements.updatePathPropertiesStmt ||
      this.dbWriteConnection.prepare(
        `
          UPDATE ${this.targetMapSchema}.target_map_ppg_paths
            SET properties = json_set(properties, '$.' || ?, json(?))
            WHERE ( path_id = ? )
        `,
      );

    // @ts-ignore
    return this.preparedWriteStatements.updatePathPropertiesStmt;
  }

  updatePathProperties(pathId: number, key: string, value: any) {
    this.updatePathPropertiesStmt.run([key, JSON.stringify(value), pathId]);
  }

  truncatePathTables() {
    this.dbWriteConnection.exec(`
      DELETE FROM ${this.targetMapSchema}.target_map_ppg_path_labels ;
      DELETE FROM ${this.targetMapSchema}.target_map_ppg_path_edges ;
      DELETE FROM ${this.targetMapSchema}.target_map_ppg_paths;
    `);
  }

  bulkLoadPaths(
    pathIterator: Generator<PreloadedTargetMapPath>,
    pathLevel: string,
    clean: boolean,
  ) {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      if (clean) {
        this.truncatePathTables();
      }

      for (const { edgeIdSequence, properties } of pathIterator) {
        const pathId = this.insertPath({ edgeIdSequence, properties });

        if (pathId !== null) {
          this.insertPathLabel({
            pathId,
            label: pathLevel,
          });
        }
      }

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      this.dbWriteConnection.exec('ROLLBACK;');
      throw err;
    }
  }

  private prepareTargetMapIdsForEdgeIdsStmt(numEdgeIds: number) {
    this.preparedReadStatements.targetMapIdsForEdgeIdsStmts =
      this.preparedReadStatements.targetMapIdsForEdgeIdsStmts || {};

    if (!this.preparedReadStatements.targetMapIdsForEdgeIdsStmts[numEdgeIds]) {
      this.preparedReadStatements.targetMapIdsForEdgeIdsStmts[
        numEdgeIds
      ] = this.dbReadConnection.prepare(
        `
          SELECT
              edge_id,
              target_map_id
            FROM ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
            WHERE ( edge_id IN (${new Array(numEdgeIds).fill('?')}) ) ;
        `,
      );
    }

    return this.preparedReadStatements.targetMapIdsForEdgeIdsStmts[numEdgeIds];
  }

  private get allTargetMapPathIdsStmt(): Statement {
    if (!this.preparedReadStatements.allTargetMapPathIdsStmt) {
      this.preparedReadStatements.allTargetMapPathIdsStmt = this.dbReadConnection.prepare(
        `
          SELECT
              path_id
            FROM ${this.targetMapSchema}.target_map_ppg_paths
            ORDER BY 1 ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.allTargetMapPathIdsStmt;
  }

  *makeTargetMapPathIdsIterator(): Generator<TargetMapPathId> {
    const iter = this.allTargetMapPathIdsStmt.raw().iterate();

    for (const [pathId] of iter) {
      yield pathId;
    }
  }

  private get randomizedAllTargetMapPathIdsStmt(): Statement {
    if (!this.preparedReadStatements.randomizedAllTargetMapPathIdsStmt) {
      this.preparedReadStatements.randomizedAllTargetMapPathIdsStmt = this.dbReadConnection.prepare(
        `
          SELECT
              path_id
            FROM ${this.targetMapSchema}.target_map_ppg_paths
            ORDER BY random() ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.randomizedAllTargetMapPathIdsStmt;
  }

  *makeRandomizedTargetMapPathIdsIterator(): Generator<TargetMapPathId> {
    const iter = this.randomizedAllTargetMapPathIdsStmt.raw().iterate();

    for (const [pathId] of iter) {
      yield pathId;
    }
  }

  private get preparedTargetMapPathEdgesStmt(): Statement {
    this.preparedReadStatements.prepareTargetMapPathEdgesStmt =
      this.preparedReadStatements.prepareTargetMapPathEdgesStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              path_edge_idx,
              feature
            FROM ${this.targetMapSchema}.target_map_ppg_path_edges
              INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_line_features
                USING (edge_id)
            WHERE ( path_id = ? ) ;`,
      );

    return this.preparedReadStatements.prepareTargetMapPathEdgesStmt;
  }

  *makeMergedTargetMapPathIterator(): Generator<turf.Feature<turf.LineString>> {
    const iter = this.allTargetMapPathIdsStmt.raw().iterate();

    for (const [pathId] of iter) {
      console.log(pathId);
      const result = this.preparedTargetMapPathEdgesStmt.all([pathId]);

      const coords = _(result)
        .sortBy('path_edge_idx')
        .map((r) => turf.getCoords(JSON.parse(r.feature)))
        .flattenDeep()
        .chunk(2)
        .value();

      const lineString = turf.lineString(
        coords,
        { targetMapPathId: pathId },
        { id: pathId },
      );

      yield lineString;
    }
  }

  transformEdgeIdSequenceToTargetMapIdSequence(
    edgeIds: TargetMapEdgeId[],
  ): TargetMapId[] {
    const queryStmt = this.prepareTargetMapIdsForEdgeIdsStmt(edgeIds.length);

    const result = queryStmt.raw().all(edgeIds);

    const lookupTable = result.reduce(
      (acc: Record<TargetMapEdgeId, TargetMapId>, [edgeId, targetMapId]) => {
        acc[edgeId] = targetMapId;
        return acc;
      },
      {},
    );

    const targetMapIds = edgeIds.map((edgeId) => lookupTable[edgeId]);

    return targetMapIds;
  }

  private prepareEdgeIdsForTargetMapIdsStmt(numIds: number) {
    this.preparedReadStatements.edgeIdsForTargetMapIdsStmts =
      this.preparedReadStatements.edgeIdsForTargetMapIdsStmts || {};

    if (!this.preparedReadStatements.edgeIdsForTargetMapIdsStmts[numIds]) {
      this.preparedReadStatements.edgeIdsForTargetMapIdsStmts[
        numIds
      ] = this.dbReadConnection.prepare(
        `
          SELECT
              edge_id,
              target_map_id
            FROM ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
            WHERE ( target_map_id IN (${new Array(numIds).fill('?')}) ) ;
        `,
      );
    }

    return this.preparedReadStatements.edgeIdsForTargetMapIdsStmts[numIds];
  }

  transformTargetMapIdSequenceToEdgeIdSequence(
    targetMapIds: TargetMapId[],
  ): TargetMapEdgeId[] {
    const queryStmt = this.prepareEdgeIdsForTargetMapIdsStmt(
      targetMapIds.length,
    );

    const result = queryStmt.raw().all(targetMapIds);

    const lookupTable = result.reduce(
      (acc: Record<TargetMapId, TargetMapEdgeId>, [edgeId, targetMapId]) => {
        acc[targetMapId] = edgeId;
        return acc;
      },
      {},
    );

    const edgeIds = targetMapIds.map((targetMapId) => lookupTable[targetMapId]);

    return edgeIds;
  }

  private prepareAllPathsTraversingEdgesStmt(numEdgeIds: number) {
    this.preparedReadStatements.allPathsTraversingEdgesStmt =
      this.preparedReadStatements.allPathsTraversingEdgesStmt || {};

    if (!this.preparedReadStatements.allPathsTraversingEdgesStmt[numEdgeIds]) {
      const whereClause = getEdgeIdsWhereClause(numEdgeIds);

      this.preparedReadStatements.allPathsTraversingEdgesStmt[
        numEdgeIds
      ] = this.dbReadConnection.prepare(
        `
          SELECT
              json_group_array(DISTINCT path_id)
            FROM ${this.targetMapSchema}.target_map_ppg_path_edges
            ${whereClause} ;`,
      );
    }

    return this.preparedReadStatements.allPathsTraversingEdgesStmt[numEdgeIds];
  }

  getAllPathsTraversingEdges(queryParams: {
    edgeIds: TargetMapEdgeId[];
  }): TargetMapPath['id'][] {
    const { edgeIds } = queryParams;

    const queryStmt = this.prepareAllPathsTraversingEdgesStmt(edgeIds.length);

    const [result] = queryStmt.raw().get(edgeIds);

    const pathIds = JSON.parse(result);

    pathIds.sort(ascendingNumberComparator);

    return pathIds;
  }

  private get deleteAllPathsWithLabelStmt(): Statement {
    if (!this.preparedWriteStatements.deleteAllPathsWithLabelStmt) {
      this.preparedWriteStatements.deleteAllPathsWithLabelStmt = this.dbWriteConnection.prepare(
        `
          DELETE
            FROM ${this.targetMapSchema}.target_map_ppg_paths
            WHERE path_id IN (
              SELECT
                  path_id
                FROM ${this.targetMapSchema}.target_map_ppg_path_labels
                WHERE ( label = ? )
            ) ; `,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.deleteAllPathsWithLabelStmt;
  }

  deleteAllPathsWithLabel(label: string): number {
    const { changes: numPathsDeleted } = this.deleteAllPathsWithLabelStmt.run(
      label,
    );

    return numPathsDeleted;
  }

  private get rawEdgeFeaturesStmt(): Statement {
    if (!this.preparedReadStatements.rawEdgeFeaturesStmt) {
      const sql = `
        SELECT
            feature
          FROM ${this.targetMapSchema}.raw_target_map_features
          WHERE target_map_id IN (
            SELECT
                value
              FROM (
                  SELECT json(?) AS target_map_id_arr
                ) AS t, json_each(t.target_map_id_arr)
          )
          ORDER BY target_map_id ;
      `;

      this.preparedReadStatements.rawEdgeFeaturesStmt = this.dbReadConnection.prepare(
        sql,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.rawEdgeFeaturesStmt;
  }

  getRawEdgeFeatures(targetMapIds: TargetMapId[]): RawTargetMapFeature[] {
    const features = this.rawEdgeFeaturesStmt
      .raw()
      .all([JSON.stringify(targetMapIds)])
      .map(([featureStr]) => JSON.parse(featureStr));

    return features;
  }

  private get allRawEdgeFeaturesStmt(): Statement {
    if (!this.preparedReadStatements.allRawEdgeFeaturesStmt) {
      const sql = `
        SELECT
            feature
          FROM ${this.targetMapSchema}.raw_target_map_features
          ORDER BY target_map_id;
      `;

      this.preparedReadStatements.allRawEdgeFeaturesStmt = this.dbReadConnection.prepare(
        sql,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.allRawEdgeFeaturesStmt;
  }

  // Can be wrapped to create induced subgraph iterators.
  *makeRawEdgeFeaturesIterator(): Generator<T> {
    const iter = this.allRawEdgeFeaturesStmt.raw().iterate();

    for (const [f] of iter) {
      const feature = JSON.parse(f);

      yield feature;
    }
  }

  private getGroupedRawEdgeFeaturesStmt(
    numProps: number,
    numIds: number | null,
  ): Statement {
    // eslint-disable-next-line no-param-reassign
    numIds = numIds === null ? -1 : numIds;

    this.preparedReadStatements.groupedRawEdgeFeaturesStmt =
      this.preparedReadStatements.groupedRawEdgeFeaturesStmt || {};

    this.preparedReadStatements.groupedRawEdgeFeaturesStmt[numProps] =
      this.preparedReadStatements.groupedRawEdgeFeaturesStmt[numProps] || {};

    if (
      !this.preparedReadStatements.groupedRawEdgeFeaturesStmt[numProps][numIds]
    ) {
      const groupPropsSelectClauses = _.range(0, numProps)
        .map(
          (i) =>
            `json_extract(feature, '$.properties.' || ?, '$.dummy') AS prop_${i}`,
        )
        .join(',\n\t\t');

      const whereClause =
        numIds > -1 ? `target_map_id IN (${new Array(numIds).fill('?')})` : '';

      const groupBySeq = _.range(1, numProps + 1);

      const sql = `
        SELECT
            ${groupPropsSelectClauses},
            json_group_array(
              json(feature)
            ) AS stringified_features_arr
          FROM ${this.targetMapSchema}.raw_target_map_features
          ${whereClause}
          GROUP BY ${groupBySeq}
          ORDER BY ${groupBySeq} ;
      `;

      this.preparedReadStatements.groupedRawEdgeFeaturesStmt[numProps][
        numIds
      ] = this.dbReadConnection.prepare(sql);
    }

    // @ts-ignore
    return this.preparedReadStatements.groupedRawEdgeFeaturesStmt[numProps][
      numIds
    ];
  }

  // Can be wrapped to create induced subgraph iterators.
  *makeGroupedRawEdgeFeaturesIterator(queryParams: {
    targetMapIds?: TargetMapId[] | null;
    groupByRawProperties: { 0: string } & Array<string>;
  }): Generator<
    Record<string, any> & {
      features: RawTargetMapFeature[];
    }
  > {
    const { targetMapIds = null, groupByRawProperties } = queryParams;

    const props = _.uniq(groupByRawProperties);

    const iterQuery = this.getGroupedRawEdgeFeaturesStmt(
      props.length,
      targetMapIds && targetMapIds.length,
    );

    const boundParams: Array<string | number> = [...props];

    if (targetMapIds !== null) {
      boundParams.push(...targetMapIds);
    }
    const iter = iterQuery.iterate(boundParams);

    for (const row of iter) {
      const features = JSON.parse(row.stringified_features_arr);

      const groupProps = props.reduce((acc, prop, i) => {
        [acc[prop]] = JSON.parse(row[`prop_${i}`]);
        return acc;
      }, {});

      yield {
        ...groupProps,
        features,
      };
    }
  }

  get targetMapEdgeFeaturesStmt(): Statement {
    if (!this.preparedReadStatements.targetMapEdgeFeaturesStmt) {
      this.preparedReadStatements.targetMapEdgeFeaturesStmt = this.dbReadConnection.prepare(
        `
          WITH cte_specified_edge_ids(edge_ids_arr) AS (
            SELECT json(?) AS edge_ids_arr
          ), cte_specified_geopoly(bounding_geopoly) AS (
            SELECT json(?) AS bounding_geopoly
          )
          SELECT
              feature
            FROM ${this.targetMapSchema}.target_map_ppg_edge_line_features
            WHERE (
              ( -- No filtering specified, return all.
                ( SELECT json(edge_ids_arr) = json('null') FROM cte_specified_edge_ids )
                AND
                ( SELECT bounding_geopoly = 'null' FROM cte_specified_geopoly )
              )
              OR
              ( -- UNION of the edgeList and the edges overlapping the specified geopoly
                ( -- EdgeId in the specified list
                  edge_id IN (
                    SELECT
                        value AS edge_id
                      FROM cte_specified_edge_ids, json_each(edge_ids_arr)
                  )
                )
                OR
                ( -- Edges overlap the Polygon
                  edge_id IN (
                    SELECT
                        edge_id
                      FROM ${this.targetMapSchema}.target_map_ppg_edges_geopoly_idx
                      WHERE geopoly_overlap(
                        _shape,
                        ( SELECT bounding_geopoly FROM cte_specified_geopoly )
                      )
                  )
                )
              )
            )
            ORDER BY geoprox_key;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.targetMapEdgeFeaturesStmt;
  }

  *makeTargetMapEdgesGeoproximityIterator(queryParams?: {
    edgeIds?: TargetMapEdgeId[] | null;
    boundingPolygon?: QueryPolygon | null;
  }): TargetMapEdgesGeoproximityIterator {
    const { edgeIds = null, boundingPolygon = null } = queryParams || {};

    const specifiedGeoPoly =
      boundingPolygon && turf.getCoords(boundingPolygon)[0];

    const iterQuery = this.targetMapEdgeFeaturesStmt;

    const iter: IterableIterator<string> = iterQuery
      .raw()
      .iterate([JSON.stringify(edgeIds), JSON.stringify(specifiedGeoPoly)]);

    for (const [featureStr] of iter) {
      const feature = JSON.parse(featureStr);

      yield feature;
    }
  }

  private get targetMapEdgesOverlappingPolyStmt(): Statement {
    if (!this.preparedReadStatements.targetMapEdgesOverlappingPolyStmt) {
      // TODO TODO TODO This belongs in a VIEW
      this.preparedReadStatements.targetMapEdgesOverlappingPolyStmt = this.dbReadConnection.prepare(
        `
          SELECT
              edge_features.feature AS targetMapPathEdge
            FROM ${this.targetMapSchema}.target_map_ppg_edge_line_features AS edge_features
              INNER JOIN (
                SELECT
                    edge_id
                  FROM ${this.targetMapSchema}.target_map_ppg_edges_geopoly_idx
                  WHERE geopoly_overlap(_shape, ?) -- GeoPoly Coords is 1st bound param.
              ) USING (edge_id)
            WHERE (
              edge_id NOT IN (
                SELECT
                    value AS edge_id
                  FROM (
                    SELECT json(?) AS target_map_id_arr -- Excluded TargetMapEdgeIds is 2nd bound params.
                  ) AS t, json_each(t.target_map_id_arr)
              )
            ) ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.targetMapEdgesOverlappingPolyStmt;
  }

  getTargetMapEdgesOverlappingPoly(
    boundingPolyCoords: number[][],
    queryParams: { excludedTargetMapEdges?: number[] },
  ): TargetMapEdge[] {
    const { excludedTargetMapEdges } = queryParams || {};

    const excluded = _.isEmpty(excludedTargetMapEdges)
      ? []
      : excludedTargetMapEdges;

    const targetMapEdges = this.targetMapEdgesOverlappingPolyStmt
      .raw()
      .all([JSON.stringify(boundingPolyCoords[0]), JSON.stringify(excluded)])
      .map(([targetMapPathEdgeStr]) => JSON.parse(targetMapPathEdgeStr));

    return targetMapEdges;
  }

  vacuumDatabase() {
    const targetMapSchema = this.targetMapSchema || '';
    this.dbWriteConnection.exec(`VACUUM ${targetMapSchema};`);
  }
}
