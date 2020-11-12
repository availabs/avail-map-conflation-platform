/* eslint-disable no-restricted-syntax, no-underscore-dangle */

// Massive violation of single responsibility principle.

import { readFileSync } from 'fs';
import { join } from 'path';

import { Statement } from 'better-sqlite3';
import * as turf from '@turf/turf';
import _ from 'lodash';

import getGeoProximityKey from '../getGeoProximityKey';

import { Coordinate } from '../../domain';

const ascendingNumberComparator = (a: number, b: number) => a - b;

const initializeTargetMapDatabaseTemplateSql = readFileSync(
  join(__dirname, './initialize_target_map_database.sql'),
).toString();

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
  startCoord: Coordinate;
  endCoord: Coordinate;
  properties: { targetMapId: TargetMapId } & Record<string, any>;
  coordinates: [number, number][] | [number, number][][];
};

export type TargetMapEdge = {
  id: TargetMapEdgeId;
  properties: PreloadedTargetMapEdge['properties'];
  labels: TargetMapEntityLabel[];
};

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

const getEdgeIdsWhereClause = (n: number | null) =>
  n !== null && n > -1
    ? `WHERE ( edge_id IN (${new Array(n).fill('?')}) )`
    : '';

export default class TargetMapDAO {
  private readonly db: any;

  private readonly schema: string | null;

  private readonly preparedStatements: {
    insertNodeStmt?: Statement;
    insertEdgeStmt?: Statement;
    insertPathStmt?: Statement;
    insertPathEdgeStmt?: Statement;
    insertPathLabelStmt?: Statement;
    targetMapIdsForEdgeIdsStmts?: Record<number, Statement>;
    edgeIdsForTargetMapIdsStmts?: Record<number, Statement>;
    allPathsTraversingEdgesStmt?: Record<number, Statement>;
    deleteAllPathsWithLabelStmt?: Statement;
    rawEdgeFeaturesStmt?: Statement;
    groupedRawEdgeFeaturesStmt?: Record<number, Record<number, Statement>>;
    targetMapEdgeFeaturesStmt?: Record<number, Statement>;
    insertShstMatchStmt?: Statement;
    insertPathShstMatchSegmentStmt?: Statement;
    allShstMatchFeaturesStmt?: Statement;
    truncateMatchesTablesStmt?: Statement;
  };

  constructor(db: any, schema?: string) {
    this.db = db;
    this.schema = schema || null;

    // Initialize the INSERT prepared statements.
    this.preparedStatements = {};
  }

  private get schemaQualifier() {
    return this.schema !== null ? `${this.schema}.` : '';
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

  private get insertNodeStmt(): Statement {
    if (!this.preparedStatements.insertNodeStmt) {
      this.preparedStatements.insertNodeStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_ppg_nodes (
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

    return edgeId;
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
            path_idx,
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

    for (let pathIdx = 0; pathIdx < edgeIdSequence.length; ++pathIdx) {
      const edgeId = edgeIdSequence[pathIdx];

      this.insertPathEdgeStmt.run([pathId, pathIdx, edgeId]);
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

  private prepareTargetMapIdsForEdgeIdsStmt(numIds: number) {
    this.preparedStatements.targetMapIdsForEdgeIdsStmts =
      this.preparedStatements.targetMapIdsForEdgeIdsStmts || {};

    if (!this.preparedStatements.targetMapIdsForEdgeIdsStmts[numIds]) {
      this.preparedStatements.targetMapIdsForEdgeIdsStmts[
        numIds
      ] = this.db.prepare(
        `
          SELECT
              edge_id,
              target_map_id
            FROM ${this.schemaQualifier}target_map_ppg_edge_id_to_target_map_id
            WHERE ( edge_id IN (${new Array(numIds).fill('?')}) ) ;
        `,
      );
    }

    return this.preparedStatements.targetMapIdsForEdgeIdsStmts[numIds];
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

  private prepareAllPathsTraversingEdgesStmt(numIds: number) {
    this.preparedStatements.allPathsTraversingEdgesStmt =
      this.preparedStatements.allPathsTraversingEdgesStmt || {};

    if (!this.preparedStatements.allPathsTraversingEdgesStmt[numIds]) {
      const whereClause = getEdgeIdsWhereClause(numIds);

      this.preparedStatements.allPathsTraversingEdgesStmt[
        numIds
      ] = this.db.prepare(
        `
          SELECT
              json_group_array(DISTINCT path_id)
            FROM ${this.schemaQualifier}target_map_ppg_path_edges
            ${whereClause} ;`,
      );
    }

    return this.preparedStatements.allPathsTraversingEdgesStmt[numIds];
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
          FROM ${this.schemaQualifier}raw_target_map_features ;
      `;

      this.preparedStatements.rawEdgeFeaturesStmt = this.db.prepare(sql);
    }

    // @ts-ignore
    return this.preparedStatements.rawEdgeFeaturesStmt;
  }

  // Can be wrapped to create induced subgraph iterators.
  *makeRawEdgeFeaturesIterator(): Generator<
    turf.Feature<turf.LineString | turf.MultiLineString>
  > {
    const iter = this.rawEdgeFeaturesStmt.raw().iterate();

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
      features: turf.Feature<turf.LineString | turf.MultiLineString>[];
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

  private prepareTargetMapEdgeFeaturesStmt(numIds: number | null): Statement {
    // eslint-disable-next-line no-param-reassign
    numIds = numIds === null ? -1 : numIds;

    this.preparedStatements.targetMapEdgeFeaturesStmt =
      this.preparedStatements.targetMapEdgeFeaturesStmt || {};

    if (!this.preparedStatements.targetMapEdgeFeaturesStmt[numIds]) {
      const whereClause = getEdgeIdsWhereClause(numIds);

      this.preparedStatements.targetMapEdgeFeaturesStmt[
        numIds
      ] = this.db.prepare(
        `
          SELECT
              feature
            FROM ${this.schemaQualifier}target_map_ppg_edge_line_features
            ${whereClause}
            ORDER BY geoprox_key; `,
      );
    }

    return this.preparedStatements.targetMapEdgeFeaturesStmt[numIds];
  }

  *makeTargetMapEdgeFeaturesIterator(queryParams?: {
    edgeIds: TargetMapEdgeId[];
  }): Generator<turf.Feature<turf.LineString | turf.MultiLineString>> {
    const { edgeIds = null } = queryParams || {};

    const iterQuery = this.prepareTargetMapEdgeFeaturesStmt(
      edgeIds && edgeIds.length,
    );

    const iter: IterableIterator<string> =
      edgeIds === null
        ? iterQuery.raw().iterate()
        : iterQuery.raw().iterate(edgeIds);

    for (const [featureStr] of iter) {
      const feature = JSON.parse(featureStr);

      yield feature;
    }
  }

  private get insertShstMatchStmt(): Statement {
    if (!this.preparedStatements.insertShstMatchStmt) {
      this.preparedStatements.insertShstMatchStmt = this.db.prepare(
        `
          INSERT OR IGNORE INTO ${this.schemaQualifier}target_map_edges_shst_matches (
            edge_id,
            shst_reference,
            section_start,
            section_end,
            feature_len_km,
            feature
          ) VALUES (?, ?, ?, ?, ?, json(?)) ; `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertShstMatchStmt;
  }

  insertShstMatch(shstMatchFeature: any) {
    const {
      properties: {
        shstReferenceId,
        section: [section_start, section_end],
        pp_id: edgeId,
      },
    } = shstMatchFeature;

    const featureLenKm = _.round(turf.length(shstMatchFeature), 6);

    const { changes, lastInsertRowid } = this.insertShstMatchStmt.run([
      `${edgeId}`,
      `${shstReferenceId}`,
      `${section_start}`,
      `${section_end}`,
      `${featureLenKm}`,
      `${JSON.stringify(shstMatchFeature)}`,
    ]);

    if (changes === 0) {
      return null;
    }

    const shstMatchId = +lastInsertRowid;

    return shstMatchId;
  }

  private get allShstMatchFeaturesStmt(): Statement {
    if (!this.preparedStatements.allShstMatchFeaturesStmt) {
      this.preparedStatements.allShstMatchFeaturesStmt = this.db.prepare(
        `
          SELECT
              json_set(
                feature,
                '$.id',
                shst_match_id
              ) as shst_match_feature
            FROM ${this.schemaQualifier}target_map_edges_shst_matches ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.allShstMatchFeaturesStmt;
  }

  *makeAllShstMatchesIterator(): Generator<
    turf.Feature<turf.LineString | turf.MultiLineString>
  > {
    const iter = this.allShstMatchFeaturesStmt.raw().iterate();

    for (const [featureStr] of iter) {
      const feature = JSON.parse(featureStr);

      yield feature;
    }
  }

  private get truncateMatchesTablesStmt(): Statement {
    if (!this.preparedStatements.truncateMatchesTablesStmt) {
      this.preparedStatements.truncateMatchesTablesStmt = this.db.prepare(
        `DELETE FROM ${this.schemaQualifier}target_map_edges_shst_matches;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.truncateMatchesTablesStmt;
  }

  truncateMatchesTables() {
    this.truncateMatchesTablesStmt.run();
  }

  vacuumDatabase() {
    const schema = this.schema || '';
    this.db.exec(`VACUUM ${schema};`);
  }
}
