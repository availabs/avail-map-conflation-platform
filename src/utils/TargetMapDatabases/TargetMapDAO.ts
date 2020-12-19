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

const ascendingNumberComparator = (a: number, b: number) => a - b;

const initializeTargetMapDatabaseTemplateSql = readFileSync(
  join(__dirname, './initialize_target_map_database.sql'),
).toString();

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

// NOTE: This is a dupe of src/daos/SourceMapDao/domain/types.SharedStreetsMatchFeature
export interface PreloadedSharedStreetsMatchFeature
  extends turf.Feature<turf.LineString> {
  properties: Record<string, any> & {
    readonly shstReferenceId: string;
    readonly shstGeometryId: string;
    readonly shstFromIntersectionId: string;
    readonly shstToIntersectionId: string;
    readonly referenceLength: number;
    readonly section: [number, number];
    readonly gisReferenceId: string;
    readonly gisGeometryId: string;
    readonly gisTotalSegments: number;
    readonly gisSegmentIndex: number;
    readonly gisFromIntersectionId: string;
    readonly gisToIntersectionId: string;
    readonly startSideOfStreet: 'right' | 'left';
    readonly endSideOfStreet: 'right' | 'left';
    readonly sideOfStreet: 'right' | 'left' | 'unknown';
    readonly score: number;
    readonly matchType: 'string';
  };
  geometry: turf.LineString;
}

export interface SharedStreetsMatchFeature
  extends PreloadedSharedStreetsMatchFeature {
  id: number;
}

export type SharedStreetsMatchMetadata = {
  shst_match_id: number;
  shst_reference: string;
  shst_ref_start: number;
  shst_ref_end: number;
};

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

export type TargetMapPathEdgeMatches = {
  targetMapPathEdge: TargetMapPathEdgeFeature;
  shstMatches: SharedStreetsMatchFeature[] | null;
};

export type TargetMapPathMatches = TargetMapPathEdgeMatches[];

export interface TargetMapPathChosenMatchesMetadata {
  pathLength: number;
  chosenMatchesTotalLength: number;
  numEdges: number;
  numEdgesWithChosenMatches: number;
  edgeMatchesLengthRatios: number[];
}

export type TargetMapPathEdgeChosenMatches =
  | (SharedStreetsMatchFeature['id'] | null)[][]
  | null;

export type TargetMapPathMatchesIterator = Generator<{
  targetMapPathId: TargetMapPathId;
  targetMapPathMatches: TargetMapPathEdgeMatches[] | null;
}>;

export type TargetMapPathChosenMatches = {
  targetMapPathId: TargetMapPathId;
  chosenShstMatches: TargetMapPathEdgeChosenMatches[] | null;
  chosenShstMatchesMetadata: TargetMapPathChosenMatchesMetadata | null;
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
    targetMapEdgeFeaturesStmt?: Record<number, Statement>;
    insertShstMatchStmt?: Statement;
    insertPathShstMatchSegmentStmt?: Statement;
    allShstMatchFeaturesStmt?: Statement;
    shstMatchMetadataByTargetMapIdStmt?: Statement;
    truncateMatchesTablesStmt?: Statement;
    truncatePathMatchChainsTablesStmt?: Statement;
    shstMatchesForPathStmt?: Record<number, Record<number, Statement>>;
    insertPathChosenMatchesStmt?: Statement;
    insertPathChosenMatchesMetadataStmt?: Statement;
    truncatePathChosenMatchesStmt?: Statement;
    truncateEdgeChosenMatchesStmt?: Statement;
    insertOptimalTargetMapEdgeChosenMatchesStmt?: Statement;
    targetMapEdgesChosenMatchesStmt?: Statement;
  };

  constructor(xdb?: any, schema?: string | null) {
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

  // eslint-disable-next-line import/prefer-default-export
  loadMicroLevel(initialize: boolean) {
    const xdb = this.db.openLoadingConnectionToDb(this.schema);

    // @ts-ignore
    xdb.unsafeMode(true);

    const xTargetMapDao = new TargetMapDAO(xdb, this.schema);

    try {
      xdb.exec('BEGIN EXCLUSIVE;');

      if (initialize) {
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

        const edgeId = xTargetMapDao.insertEdge(edge);
        console.log(edgeId);
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
      console.log(JSON.stringify({ properties, edgeIdSequence }, null, 4));
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

  private prepareTargetMapEdgeFeaturesStmt(
    numEdgeIds: number | null,
  ): Statement {
    // eslint-disable-next-line no-param-reassign
    numEdgeIds = numEdgeIds === null ? -1 : numEdgeIds;

    this.preparedStatements.targetMapEdgeFeaturesStmt =
      this.preparedStatements.targetMapEdgeFeaturesStmt || {};

    if (!this.preparedStatements.targetMapEdgeFeaturesStmt[numEdgeIds]) {
      const whereClause = getEdgeIdsWhereClause(numEdgeIds);

      this.preparedStatements.targetMapEdgeFeaturesStmt[
        numEdgeIds
      ] = this.db.prepare(
        `
          SELECT
              feature
            FROM ${this.schemaQualifier}target_map_ppg_edge_line_features
            ${whereClause}
            ORDER BY geoprox_key; `,
      );
    }

    return this.preparedStatements.targetMapEdgeFeaturesStmt[numEdgeIds];
  }

  *makeTargetMapEdgeFeaturesIterator(queryParams?: {
    edgeIds: TargetMapEdgeId[];
  }): Generator<TargetMapEdgeFeature> {
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

  insertShstMatch(
    shstMatchFeature: PreloadedSharedStreetsMatchFeature,
  ): SharedStreetsMatchFeature['id'] | null {
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

  private get shstMatchMetadataByTargetMapIdStmt(): Statement {
    if (!this.preparedStatements.shstMatchMetadataByTargetMapIdStmt) {
      this.preparedStatements.shstMatchMetadataByTargetMapIdStmt = this.db.prepare(
        `
          SELECT
              target_map_id,
              json_group_array(
                json_object(
                  'shst_match_id',
                  shst_match_id,
                  'shst_reference',
                  shst_reference,
                  'shst_ref_start',
                  section_start,
                  'shst_ref_end',
                  section_end
                )
              ) as shst_matches_metadata
            FROM ${this.schemaQualifier}target_map_edges_shst_matches
              INNER JOIN ${this.schemaQualifier}target_map_ppg_edge_id_to_target_map_id
                USING (edge_id)
            GROUP BY target_map_id
          ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.shstMatchMetadataByTargetMapIdStmt;
  }

  *makeShstMatchMetadataByTargetMapIdIterator(): Generator<{
    targetMapId: RawTargetMapFeatureFeature['id'];
    shstMatchesMetadata: SharedStreetsMatchMetadata[];
  }> {
    const iter = this.shstMatchMetadataByTargetMapIdStmt.raw().iterate();

    for (const [targetMapId, shstMatchesMetadataStr] of iter) {
      const shstMatchesMetadata = JSON.parse(shstMatchesMetadataStr);

      yield { targetMapId, shstMatchesMetadata };
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

  private get shstMatchesForPathStmt(): Statement {
    if (!this.preparedStatements.shstMatchesForPathStmt) {
      // TODO TODO TODO This belongs in a VIEW
      this.preparedStatements.shstMatchesForPathStmt = this.db.prepare(
        `
          SELECT
              -- An array of {targetMapEdge, shstMatches}, for each path
              json_group_array(
                json_object(
                  'targetMapPathEdge',
                  json_set(
                    ppg_edges.feature,
                    '$.properties.targetMapPathId',
                    path_id,
                    '$.properties.targetMapPathIdx',
                    path_edge_idx
                  ),

                  'shstMatches',
                  NULLIF(
                    json(shst_matches),
                    json('[null]')
                  )
                )
              ) AS unorderedPathWithMatches
            FROM (
                SELECT
                    path_id,
                    path_edge_idx,
                    edge_id,
                    -- For each Edge, an array of all the ShstMatches
                    json_group_array(
                      -- Set the DB generated ID as the feature ID.
                      json_set(
                        matches.feature,
                        '$.id',
                        matches.shst_match_id
                      )
                    ) AS shst_matches
                  FROM ${this.schemaQualifier}target_map_ppg_path_edges AS ppg_paths
                    LEFT OUTER JOIN ${this.schemaQualifier}target_map_edges_shst_matches AS matches
                      USING (edge_id)
                  GROUP BY path_id, path_edge_idx, edge_id
              ) AS agg_path_matches
                INNER JOIN ${this.schemaQualifier}target_map_ppg_edge_line_features AS ppg_edges
                  USING (edge_id)
            WHERE (path_id = ?)
          ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.shstMatchesForPathStmt;
  }

  *makeTargetMapPathMatchesIterator(queryParams?: {
    pathIds: TargetMapPathId[];
  }): TargetMapPathMatchesIterator {
    const pathIdsIter =
      queryParams?.pathIds ?? this.makeTargetMapPathIdsIterator();

    for (const targetMapPathId of pathIdsIter) {
      // We get the matches on-demand so that the chooser can insert matches as needed.
      //  EG: Match mutations or gap-filling "matches"
      const unorderedTargetMapEdgeMatchesStr = this.shstMatchesForPathStmt
        .raw()
        .get([targetMapPathId]);

      if (!unorderedTargetMapEdgeMatchesStr) {
        yield { targetMapPathId, targetMapPathMatches: null };
        continue;
      }

      // Guaranteed to be grouped by path_id, however
      //  the order of the edges along the path is not guaranteed.
      const unorderedTargetMapEdgeMatches: TargetMapPathEdgeMatches[] = JSON.parse(
        unorderedTargetMapEdgeMatchesStr,
      );

      const pathEdgeIdxPath = [
        'targetMapPathEdge',
        'properties',
        'targetMapPathIdx',
      ];

      // Sort by the path edges topologically.
      const orderedTargetMapEdgeMatches = unorderedTargetMapEdgeMatches.sort(
        (a, b) => _.get(a, pathEdgeIdxPath) - _.get(b, pathEdgeIdxPath),
      );

      const targetMapPathMatches = orderedTargetMapEdgeMatches.map((e) =>
        _.omit(e, 'path_id'),
      );

      yield { targetMapPathId, targetMapPathMatches };
    }
  }

  private get insertPathChosenMatchesMetadataStmt() {
    if (!this.preparedStatements.insertPathChosenMatchesMetadataStmt) {
      this.preparedStatements.insertPathChosenMatchesMetadataStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_paths_shst_match_chains_metadata (
            path_id,
            metadata
          ) VALUES(?, json(?)) ; `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertPathChosenMatchesMetadataStmt;
  }

  private get insertPathChosenMatchesStmt() {
    if (!this.preparedStatements.insertPathChosenMatchesStmt) {
      this.preparedStatements.insertPathChosenMatchesStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_paths_shst_match_chains (
            path_id,
            path_edge_idx,
            edge_chain_idx,
            edge_chain_link_idx,
            shst_match_id
          ) VALUES(?, ?, ?, ?, ?) ; `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertPathChosenMatchesStmt;
  }

  insertPathChosenMatches(
    targetMapPathChosenMatches: TargetMapPathChosenMatches,
  ) {
    console.log(JSON.stringify({ targetMapPathChosenMatches }, null, 4));

    const {
      targetMapPathId,
      chosenShstMatches,
      chosenShstMatchesMetadata,
    } = targetMapPathChosenMatches;

    if (chosenShstMatches === null) {
      return;
    }

    this.insertPathChosenMatchesMetadataStmt?.run([
      targetMapPathId,
      JSON.stringify(chosenShstMatchesMetadata),
    ]);

    // TODO: All of this should be moved into the
    //       TargetMapDAO.insertTargetMapPathChosenMatches method
    for (
      let pathEdgeIdx = 0;
      pathEdgeIdx < chosenShstMatches.length;
      ++pathEdgeIdx
    ) {
      const pathEdgeChosenMatches = chosenShstMatches[pathEdgeIdx];

      // FIXME: Why is pathEdgeChosenMatches sometimes undefined?
      //        For targetMapPathId 319, using the debugger to inspect the array,
      //          the last pathEdgeChosenMatch is NULL. It is undefined in
      //          for loop condition below.
      if (
        pathEdgeChosenMatches === null ||
        pathEdgeChosenMatches === undefined
      ) {
        continue;
      }

      for (
        let edgeChainIdx = 0;
        edgeChainIdx < pathEdgeChosenMatches.length;
        ++edgeChainIdx
      ) {
        const pathEdgeChosenMatchesChain = pathEdgeChosenMatches[edgeChainIdx];

        if (pathEdgeChosenMatchesChain === null) {
          continue;
        }

        for (
          let edgeChainLinkIdx = 0;
          edgeChainLinkIdx < pathEdgeChosenMatchesChain.length;
          ++edgeChainLinkIdx
        ) {
          const shstMatchId = pathEdgeChosenMatchesChain[edgeChainLinkIdx];

          if (shstMatchId !== null) {
            this.insertPathChosenMatchesStmt?.run([
              targetMapPathId,
              pathEdgeIdx,
              edgeChainIdx,
              edgeChainLinkIdx,
              shstMatchId,
            ]);
          }
        }
      }
    }
  }

  private get truncatePathChosenMatchesStmt() {
    if (!this.preparedStatements.truncatePathChosenMatchesStmt) {
      this.preparedStatements.truncatePathChosenMatchesStmt = this.db.prepare(
        `
          DELETE FROM ${this.schemaQualifier}target_map_paths_shst_match_chains_metadata ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.truncatePathChosenMatchesStmt;
  }

  truncatePathChosenMatches() {
    this.truncatePathChosenMatchesStmt?.run();
  }

  private get truncateEdgeChosenMatchesStmt() {
    if (!this.preparedStatements.truncateEdgeChosenMatchesStmt) {
      this.preparedStatements.truncateEdgeChosenMatchesStmt = this.db.prepare(
        `
          DELETE FROM ${this.schemaQualifier}target_map_paths_edge_optimal_matches ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.truncateEdgeChosenMatchesStmt;
  }

  private get insertOptimalTargetMapEdgeChosenMatchesStmt() {
    if (!this.preparedStatements.insertOptimalTargetMapEdgeChosenMatchesStmt) {
      this.preparedStatements.insertOptimalTargetMapEdgeChosenMatchesStmt = this.db.prepare(
        `
          INSERT INTO ${this.schemaQualifier}target_map_paths_edge_optimal_matches
            SELECT
                path_id,
                path_edge_idx,
                edge_chain_idx,
                edge_chain_link_idx
              FROM (
                SELECT
                    path_id,
                    path_edge_idx,
                    row_number() OVER (
                      PARTITION BY edge_id
                      ORDER BY chosen_matches_err
                    ) AS chosen_edge_match_rank
                  FROM (
                    -- Edges are many-to-may with Paths.
                    -- Matches are chosen for Paths
                    -- Here, we find the Path chosen matches
                    --   for a Path Edge that best fits that Edge
                    --   across all the Paths to which that Edge is a member.
                    SELECT
                        path_id,
                        path_edge_idx,
                        MAX(
                          ( 1 - edge_matches_length_ratio ),
                          ( edge_matches_length_ratio - 1 )
                        ) AS chosen_matches_err
                      FROM target_map_paths_shst_match_chains
                        INNER JOIN (
                          SELECT
                              path_id,
                              key AS path_edge_idx,
                              value AS edge_matches_length_ratio
                            FROM target_map_paths_shst_match_chains_metadata,
                              json_each(metadata, '$.edgeMatchesLengthRatios')
                        ) USING (path_id, path_edge_idx)
                  ) AS sub_ranked_match_choices_for_edges
                    INNER JOIN target_map_ppg_path_edges
                      USING (path_id, path_edge_idx)
                )
                INNER JOIN target_map_paths_shst_match_chains
                  USING (path_id, path_edge_idx)
              WHERE ( chosen_edge_match_rank = 1 ) ; `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertOptimalTargetMapEdgeChosenMatchesStmt;
  }

  populateTargetMapEdgeChosenMatches() {
    this.truncateEdgeChosenMatchesStmt?.run();

    this.insertOptimalTargetMapEdgeChosenMatchesStmt?.run();
  }

  get targetMapEdgesChosenMatchesStmt() {
    if (!this.preparedStatements.targetMapEdgesChosenMatchesStmt) {
      this.preparedStatements.targetMapEdgesChosenMatchesStmt = this.db.prepare(
        `
          SELECT
              edge_id,
              target_map_id,
              json_group_array(
                json_object(
                  'edgeChainIdx',
                  edge_chain_idx,
                  'edgeChainLinkIdx',
                  edge_chain_link_idx,
                  'shstMatchId',
                  shst_match_id,
                  'shstMatchFeature',
                  json(feature)
                )
              ) AS chosenMatches
            FROM ${this.schemaQualifier}target_map_edge_chosen_matches
              INNER JOIN ${this.schemaQualifier}target_map_ppg_edge_id_to_target_map_id
                USING (edge_id)
            GROUP BY edge_id, target_map_id
        `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.targetMapEdgesChosenMatchesStmt;
  }

  *makeTargetMapEdgesChosenMatchesIterator() {
    const iter = this.targetMapEdgesChosenMatchesStmt?.raw().iterate();

    // @ts-ignore
    for (const [edgeId, targetMapId, chosenMatchesStr] of iter) {
      const chosenMatches = _(JSON.parse(chosenMatchesStr))
        .sortBy(['edgeChainIdx', 'edgeChainLinkIdx'])
        .map(
          ({
            edgeChainIdx,
            edgeChainLinkIdx,
            shstMatchId,
            shstMatchFeature,
          }) => {
            Object.assign(shstMatchFeature.properties, {
              shstMatchId,
              targetMapEdgeChainIdx: edgeChainIdx,
              targetMapEdgeChainLinkIdx: edgeChainLinkIdx,
            });

            return shstMatchFeature;
          },
        )
        .value();

      const chosenMatchesFeatureCollection = turf.featureCollection(
        chosenMatches,
      );

      yield { edgeId, targetMapId, chosenMatchesFeatureCollection };
    }
  }

  vacuumDatabase() {
    const schema = this.schema || '';
    this.db.exec(`VACUUM ${schema};`);
  }
}
