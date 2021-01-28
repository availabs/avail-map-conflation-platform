/* eslint-disable no-restricted-syntax, no-underscore-dangle */

// Massive violation of single responsibility principle.

import { readFileSync } from 'fs';
import { join } from 'path';

import { Statement } from 'better-sqlite3';
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

export interface RawTargetMapFeatureFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  id: number;
  properties: turf.Feature['properties'] & { lineartmc: string };
  geometry: turf.LineString | turf.MultiLineString;
}

export interface TargetMapEdgeFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  id: number;
  properties: turf.Feature['properties'] & { lineartmc: string };
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
  properties: { targetMapId: TargetMapId } & Record<string, any>;
  coordinates: [number, number][] | [number, number][][];
};

export type TargetMapEdge = {
  id: TargetMapEdgeId;
  properties: PreloadedTargetMapEdge['properties'];
  labels: TargetMapEntityLabel[];
};

export type TargetMapEdgesGeoproximityIterator = Generator<
  TargetMapEdgeFeature
>;

export type PreloadedTargetMapPath = {
  properties?: Record<string, any>;
  edgeIdSequence: TargetMapEdgeId[];
};

export type TargetMapPathId = number;

export type TargetMapPath = PreloadedTargetMapPath & {
  id: TargetMapPathId;
  properties: Record<string, any>;
  labels: TargetMapEntityLabel[];
};

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

export default class TargetMapDAO {
  private readonly db: any;

  readonly schema: string | null;

  private readonly preparedStatements: {
    queryTargetMapMetadata?: Statement;
    updateTargetMapMetadata?: Statement;
    setTargetMapIsCenterlineStmt?: Statement;
    insertNodeStmt?: Statement;
    insertEdgeStmt?: Statement;
    insertEdgeGeopolyStmt?: Statement;
    insertPathStmt?: Statement;
    allTargetMapPathIdsStmt?: Statement;
    insertPathEdgeStmt?: Statement;
    insertPathLabelStmt?: Statement;
    targetMapIdsForEdgeIdsStmts?: Record<number, Statement>;
    edgeIdsForTargetMapIdsStmts?: Record<number, Statement>;
    allPathsTraversingEdgesStmt?: Record<number, Statement>;
    deleteAllPathsWithLabelStmt?: Statement;
    rawEdgeFeaturesStmt?: Statement;
    allRawEdgeFeaturesStmt?: Statement;
    groupedRawEdgeFeaturesStmt?: Record<number, Record<number, Statement>>;
    targetMapEdgeFeaturesStmt?: Statement;
    targetMapEdgesOverlappingPolyStmt?: Statement;
  };

  constructor(xdb?: any, schema?: TargetMapSchema | null) {
    this.db = xdb ?? db;
    this.schema = schema || null;

    // Initialize the INSERT prepared statements.
    this.preparedStatements = {};
  }

  private get schemaQualifier() {
    return this.schema === null ? '' : `${this.schema}.`;
  }

  /**
   * WARNING: Drops all existing tables in the TargetMapDatabase.
   */
  initializeTargetMapDatabase() {
    const sql = initializeTargetMapDatabaseTemplateSql.replace(
      /__SCHEMA_QUALIFIER__/g,
      this.schemaQualifier,
    );

    this.db.exec(sql);
  }

  private get queryTargetMapMetadata(): Statement {
    if (!this.preparedStatements.queryTargetMapMetadata) {
      this.preparedStatements.queryTargetMapMetadata = this.db.prepare(
        `
          SELECT
              metadata
            FROM ${this.schemaQualifier}target_map_metadata ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.queryTargetMapMetadata;
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
    if (!this.preparedStatements.updateTargetMapMetadata) {
      this.preparedStatements.updateTargetMapMetadata = this.db.prepare(
        `
          UPDATE ${this.schemaQualifier}target_map_metadata
            SET metadata = json_set(metadata, '$.' || ?, json(?))
        `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.updateTargetMapMetadata;
  }

  private get insertNodeStmt(): Statement {
    if (!this.preparedStatements.insertNodeStmt) {
      this.preparedStatements.insertNodeStmt = this.db.prepare(
        `
          INSERT OR IGNORE INTO ${this.schemaQualifier}target_map_ppg_nodes (
            lon,
            lat,
            properties
          )
            VALUES(?, ?, json(?)) ; `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertNodeStmt;
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
    if (!this.preparedStatements.insertEdgeStmt) {
      this.preparedStatements.insertEdgeStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_ppg_edges (
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
              FROM ${this.schemaQualifier}target_map_ppg_nodes AS a
                CROSS JOIN ${this.schemaQualifier}target_map_ppg_nodes AS b
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
    return this.preparedStatements.insertEdgeStmt;
  }

  private get insertEdgeGeopolyStmt(): Statement {
    if (!this.preparedStatements.insertEdgeGeopolyStmt) {
      this.preparedStatements.insertEdgeGeopolyStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_ppg_edges_geopoly_idx (
            _shape,
            edge_id
          ) VALUES (json(?), ?) ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertEdgeGeopolyStmt;
  }

  insertEdge({
    startCoord: [startLon, startLat],
    endCoord: [endLon, endLat],
    properties,
    coordinates,
  }: PreloadedTargetMapEdge): TargetMapEdgeId | null {
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
    const feature = Array.isArray(coordinates?.[0]?.[0]?.[0])
      ? // @ts-ignore
        turf.multiLineString(coordinates)
      : // @ts-ignore
        turf.lineString(coordinates);

    const polyCoords = getBufferPolygonCoords(feature);

    const geopolyShape = _.first(polyCoords);

    this.insertEdgeGeopolyStmt.run([JSON.stringify(geopolyShape), edgeId]);

    return edgeId;
  }

  private *makePreloadedTargetMapEdgesIterator(): Generator<
    PreloadedTargetMapEdge
  > {
    const rawEdgesIter = this.makeRawEdgeFeaturesIterator();

    // Cannot do in database using SQL because we need to compute GeoProx keys
    //   The alternative it to iterate over the table while simultaneously mutating it.
    for (const feature of rawEdgesIter) {
      const { id: targetMapId } = feature;

      const mergedLineStrings = lineMerge(feature).sort(
        (a, b) => turf.length(b) - turf.length(a),
      );

      const [longestLineString] = mergedLineStrings;

      const longestLineStringCoords = turf.getCoords(longestLineString);
      const [start_longitude, start_latitude] = longestLineStringCoords[0];
      const [end_longitude, end_latitude] = longestLineStringCoords[
        longestLineStringCoords.length - 1
      ];

      const properties = { targetMapId };

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

  /**
    Warning: By default this method initializes the database. This allows the TargetMap PathPropertyGraph (TMPPG) tables initialization to happen in the same transaction as the Node and Edges loading.

    ⚠ After initialization, the TargetMap metadata is erased and will need to be restored by the caller.

    Reasons: 1) Since the Nodes and Edges are the primitive elements of TMPPG, clearing all derived tables preserves database consistency. 2) Coupling initialization and loading allows the user to rollback all changes by killing the loading process before it completes.
  */
  loadMicroLevel(clean: boolean = true) {
    const xdb = this.db.openConnectionToDb(this.schema);

    // @ts-ignore
    xdb.unsafeMode(true);

    const xTargetMapDao = new TargetMapDAO(xdb, this.schema);

    try {
      xdb.exec('BEGIN EXCLUSIVE;');

      if (clean) {
        xTargetMapDao.initializeTargetMapDatabase();
      }

      const edgesIterator = xTargetMapDao.makePreloadedTargetMapEdgesIterator();

      for (const edge of edgesIterator) {
        const {
          startCoord: [startLon, startLat],
          endCoord: [endLon, endLat],
        } = edge;

        xTargetMapDao.insertNode({
          lon: startLon,
          lat: startLat,
          properties: null,
        });

        xTargetMapDao.insertNode({
          lon: endLon,
          lat: endLat,
          properties: null,
        });

        xTargetMapDao.insertEdge(edge);
      }

      xdb.exec('COMMIT');
    } catch (err) {
      console.error(err);
      xdb.exec('ROLLBACK;');
      throw err;
    } finally {
      this.db.closeLoadingConnectionToDb(xdb);
    }
  }

  private get insertPathStmt(): Statement {
    if (!this.preparedStatements.insertPathStmt) {
      this.preparedStatements.insertPathStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_ppg_paths (
              properties
            ) VALUES (json(?)) ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertPathStmt;
  }

  private get insertPathEdgeStmt(): Statement {
    if (!this.preparedStatements.insertPathEdgeStmt) {
      this.preparedStatements.insertPathEdgeStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_ppg_path_edges (
            path_id,
            path_edge_idx,
            edge_id
          ) VALUES (?, ?, ?) ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertPathEdgeStmt;
  }

  insertPath({
    properties,
    edgeIdSequence,
  }: PreloadedTargetMapPath): TargetMapPathId | null {
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
    } catch (err) {
      console.error(JSON.stringify({ properties, edgeIdSequence }, null, 4));
      throw err;
    }

    return pathId;
  }

  private get insertPathLabelStmt(): Statement {
    if (!this.preparedStatements.insertPathLabelStmt) {
      this.preparedStatements.insertPathLabelStmt = this.db.prepare(
        `
          INSERT OR IGNORE INTO ${this.schemaQualifier}target_map_ppg_path_labels (
            path_id,
            label
          ) VALUES (?, ?) ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertPathLabelStmt;
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

  private prepareTargetMapIdsForEdgeIdsStmt(numEdgeIds: number) {
    this.preparedStatements.targetMapIdsForEdgeIdsStmts =
      this.preparedStatements.targetMapIdsForEdgeIdsStmts || {};

    if (!this.preparedStatements.targetMapIdsForEdgeIdsStmts[numEdgeIds]) {
      this.preparedStatements.targetMapIdsForEdgeIdsStmts[
        numEdgeIds
      ] = this.db.prepare(
        `
          SELECT
              edge_id,
              target_map_id
            FROM ${this.schemaQualifier}target_map_ppg_edge_id_to_target_map_id
            WHERE ( edge_id IN (${new Array(numEdgeIds).fill('?')}) ) ;
        `,
      );
    }

    return this.preparedStatements.targetMapIdsForEdgeIdsStmts[numEdgeIds];
  }

  private get allTargetMapPathIdsStmt(): Statement {
    if (!this.preparedStatements.allTargetMapPathIdsStmt) {
      this.preparedStatements.allTargetMapPathIdsStmt = this.db.prepare(
        `
          SELECT
              path_id
            FROM ${this.schemaQualifier}target_map_ppg_paths
            ORDER BY 1 ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.allTargetMapPathIdsStmt;
  }

  *makeTargetMapPathIdsIterator(): Generator<TargetMapPathId> {
    const iter = this.allTargetMapPathIdsStmt.raw().iterate();

    for (const [pathId] of iter) {
      yield pathId;
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
    this.preparedStatements.edgeIdsForTargetMapIdsStmts =
      this.preparedStatements.edgeIdsForTargetMapIdsStmts || {};

    if (!this.preparedStatements.edgeIdsForTargetMapIdsStmts[numIds]) {
      this.preparedStatements.edgeIdsForTargetMapIdsStmts[
        numIds
      ] = this.db.prepare(
        `
          SELECT
              edge_id,
              target_map_id
            FROM ${this.schemaQualifier}target_map_ppg_edge_id_to_target_map_id
            WHERE ( target_map_id IN (${new Array(numIds).fill('?')}) ) ;
        `,
      );
    }

    return this.preparedStatements.edgeIdsForTargetMapIdsStmts[numIds];
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
    this.preparedStatements.allPathsTraversingEdgesStmt =
      this.preparedStatements.allPathsTraversingEdgesStmt || {};

    if (!this.preparedStatements.allPathsTraversingEdgesStmt[numEdgeIds]) {
      const whereClause = getEdgeIdsWhereClause(numEdgeIds);

      this.preparedStatements.allPathsTraversingEdgesStmt[
        numEdgeIds
      ] = this.db.prepare(
        `
          SELECT
              json_group_array(DISTINCT path_id)
            FROM ${this.schemaQualifier}target_map_ppg_path_edges
            ${whereClause} ;`,
      );
    }

    return this.preparedStatements.allPathsTraversingEdgesStmt[numEdgeIds];
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
    if (!this.preparedStatements.deleteAllPathsWithLabelStmt) {
      this.preparedStatements.deleteAllPathsWithLabelStmt = this.db.prepare(
        `
          DELETE
            FROM ${this.schemaQualifier}target_map_ppg_paths
            WHERE path_id IN (
              SELECT
                  path_id
                FROM ${this.schemaQualifier}target_map_ppg_path_labels
                WHERE ( label = ? )
            ) ; `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.deleteAllPathsWithLabelStmt;
  }

  deleteAllPathsWithLabel(label: string): number {
    const { changes: numPathsDeleted } = this.deleteAllPathsWithLabelStmt.run(
      label,
    );

    return numPathsDeleted;
  }

  private get rawEdgeFeaturesStmt(): Statement {
    if (!this.preparedStatements.rawEdgeFeaturesStmt) {
      const sql = `
        SELECT
            feature
          FROM ${this.schemaQualifier}raw_target_map_features
          WHERE target_map_id IN (
            SELECT
                value
              FROM (
                  SELECT json(?) AS target_map_id_arr
                ) AS t, json_each(t.target_map_id_arr)
          )
          ORDER BY target_map_id ;
      `;

      this.preparedStatements.rawEdgeFeaturesStmt = this.db.prepare(sql);
    }

    // @ts-ignore
    return this.preparedStatements.rawEdgeFeaturesStmt;
  }

  getRawEdgeFeatures(
    targetMapIds: TargetMapId[],
  ): RawTargetMapFeatureFeature[] {
    const features = this.rawEdgeFeaturesStmt
      .raw()
      .all([JSON.stringify(targetMapIds)])
      .map(([featureStr]) => JSON.parse(featureStr));

    return features;
  }

  private get allRawEdgeFeaturesStmt(): Statement {
    if (!this.preparedStatements.allRawEdgeFeaturesStmt) {
      const sql = `
        SELECT
            feature
          FROM ${this.schemaQualifier}raw_target_map_features
          ORDER BY target_map_id;
      `;

      this.preparedStatements.allRawEdgeFeaturesStmt = this.db.prepare(sql);
    }

    // @ts-ignore
    return this.preparedStatements.allRawEdgeFeaturesStmt;
  }

  // Can be wrapped to create induced subgraph iterators.
  *makeRawEdgeFeaturesIterator(): Generator<RawTargetMapFeatureFeature> {
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

    this.preparedStatements.groupedRawEdgeFeaturesStmt =
      this.preparedStatements.groupedRawEdgeFeaturesStmt || {};

    this.preparedStatements.groupedRawEdgeFeaturesStmt[numProps] =
      this.preparedStatements.groupedRawEdgeFeaturesStmt[numProps] || {};

    if (!this.preparedStatements.groupedRawEdgeFeaturesStmt[numProps][numIds]) {
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
          FROM ${this.schemaQualifier}raw_target_map_features
          ${whereClause}
          GROUP BY ${groupBySeq}
          ORDER BY ${groupBySeq} ;
      `;

      this.preparedStatements.groupedRawEdgeFeaturesStmt[numProps][
        numIds
      ] = this.db.prepare(sql);
    }

    // @ts-ignore
    return this.preparedStatements.groupedRawEdgeFeaturesStmt[numProps][numIds];
  }

  // Can be wrapped to create induced subgraph iterators.
  *makeGroupedRawEdgeFeaturesIterator(queryParams: {
    targetMapIds?: TargetMapId[] | null;
    groupByRawProperties: { 0: string } & Array<string>;
  }): Generator<
    Record<string, any> & {
      features: RawTargetMapFeatureFeature[];
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
    if (!this.preparedStatements.targetMapEdgeFeaturesStmt) {
      this.preparedStatements.targetMapEdgeFeaturesStmt = this.db.prepare(
        `
          WITH cte_specified_edge_ids(edge_ids_arr) AS (
            SELECT json(?) AS edge_ids_arr
          ), cte_specified_geopoly(bounding_geopoly) AS (
            SELECT json(?) AS bounding_geopoly
          )
          SELECT
              feature
            FROM ${this.schemaQualifier}target_map_ppg_edge_line_features
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
                      FROM ${this.schemaQualifier}target_map_ppg_edges_geopoly_idx
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
    return this.preparedStatements.targetMapEdgeFeaturesStmt;
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
    if (!this.preparedStatements.targetMapEdgesOverlappingPolyStmt) {
      // TODO TODO TODO This belongs in a VIEW
      this.preparedStatements.targetMapEdgesOverlappingPolyStmt = this.db.prepare(
        `
          SELECT
              edge_features.feature AS targetMapPathEdge
            FROM ${this.schemaQualifier}target_map_ppg_edge_line_features AS edge_features
              INNER JOIN (
                SELECT
                    edge_id
                  FROM ${this.schemaQualifier}target_map_ppg_edges_geopoly_idx
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
    return this.preparedStatements.targetMapEdgesOverlappingPolyStmt;
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
    const schema = this.schema || '';
    this.db.exec(`VACUUM ${schema};`);
  }
}
