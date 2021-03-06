/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';

import db, { DatabaseSchemaName } from '../../DbService';

import SourceMapDao from '../../../daos/SourceMapDao';

import TargetMapDAO from '../../../utils/TargetMapDatabases/TargetMapDAO';

import {
  SharedStreetsMatchResult,
  SharedStreetsMatchFeature,
  SharedStreetsMatchMetadata,
  TargetMapSchema,
  TargetMapPathId,
  TargetMapEdgeId,
  RawTargetMapFeature,
  TargetMapEdgeShstMatches,
  TargetMapPathMatchesIterator,
  SharedStreetsReferenceFeature,
  ChosenMatchMetadata,
  ChosenMatchFeature,
  AssignedMatch,
  TargetMapAssignedMatch,
} from '../domain/types';

// const MIN_CHOSEN_MATCH_LEN = 0.005; [> km, 5m <]

const createShstMatchesTableSql = readFileSync(
  join(__dirname, './sql/create_shst_matches_table.sql'),
  { encoding: 'utf-8' },
);

const createChosenMatchesTableSql = readFileSync(
  join(__dirname, './sql/create_chosen_matches_table.sql'),
  { encoding: 'utf-8' },
);

const createAssignedMatchesTableSql = readFileSync(
  join(__dirname, './sql/create_assigned_matches_table.sql'),
  { encoding: 'utf-8' },
);

export default class TargetMapConflationBlackboardDao<
  T extends RawTargetMapFeature
> {
  readonly targetMapSchema: TargetMapSchema;

  protected readonly targetMapDao: TargetMapDAO<T>;

  readonly blkbrdDbSchema: DatabaseSchemaName;

  // Connections are automatically closed if garbage collected.
  //   https://github.com/JoshuaWise/better-sqlite3/issues/356#issuecomment-592748653
  private connections: {
    // Used for reads
    dbReadConnection: Database | null;
    // Used for writes
    dbWriteConnection: Database | null;
  };

  protected readonly preparedReadStatements!: {
    databaseHasBeenInitializedStmt?: Statement;
    shstMatchesTableExistsStmt?: Statement;
    shstMatchesAreLoadedStmt?: Statement;
    allShstMatchFeaturesStmt?: Statement;
    shstMatchMetadataByTargetMapIdStmt?: Statement;
    shstMatchesForPathStmt?: Statement;
    shstMatchesForTargetMapEdgesStmt?: Statement;
    chosenMatchesTableExistsStmt?: Statement;
    chosenMatchesAreLoadedStmt?: Statement;
    chosenMatchesPathStmt?: Statement;
    targetMapEdgesChosenMatchesStmt?: Statement;
    assignedMatchesTableExistsStmt?: Statement;
    assignedMatchesAreLoadedStmt?: Statement;
    allTargetMapAssignedMatchesStmt?: Statement;
    targetMapPathAssignedMatchesStats?: Statement;
  };

  protected readonly preparedWriteStatements!: {
    insertShstMatchStmt?: Statement;
    clearShstMatchesStmt?: Statement;
    insertChosenMatchStmt?: Statement;
    insertAssignedMatchStmt?: Statement;
  };

  makeTargetMapEdgeFeaturesGeoProximityIterator: TargetMapDAO<T>['makeTargetMapEdgesGeoproximityIterator'];

  static getBlackboardSchemaName(targetMapSchema: DatabaseSchemaName) {
    return `${targetMapSchema}_conflation_blackboard`;
  }

  constructor(targetMapSchema: TargetMapSchema) {
    this.targetMapSchema = targetMapSchema;
    this.blkbrdDbSchema = TargetMapConflationBlackboardDao.getBlackboardSchemaName(
      this.targetMapSchema,
    );

    this.connections = { dbReadConnection: null, dbWriteConnection: null };

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};

    this.targetMapDao = new TargetMapDAO(this.targetMapSchema);

    if (!this.databaseHasBeenInitialized) {
      this.beginWriteTransaction();
      this.initializeShstMatchesTable();
      this.initializeChosenMatchesTable();
      this.initializeAssignedMatchesTable();
      this.commitWriteTransaction();
    }

    this.makeTargetMapEdgeFeaturesGeoProximityIterator = this.targetMapDao.makeTargetMapEdgesGeoproximityIterator.bind(
      this.targetMapDao,
    );
  }

  get dbReadConnection(): Database {
    if (!this.connections.dbReadConnection) {
      this.connections.dbReadConnection = db.openConnectionToDb(
        this.blkbrdDbSchema,
        // null,
        // null,
        // { verbose: console.log.bind(console) },
      );

      db.attachDatabaseToConnection(
        this.dbReadConnection,
        this.targetMapSchema,
      );

      // FIXME: Was getting Database Locked error when running for the entire state.
      //        This did not happen when running for a County.
      //        This fixed the problem, but I don't understand why the error was
      //          happening in the first place.
      // @ts-ignore
      this.dbReadConnection.unsafeMode(true);
    }

    return this.connections.dbReadConnection;
  }

  get dbWriteConnection(): Database {
    if (!this.connections.dbWriteConnection) {
      this.connections.dbWriteConnection = db.openConnectionToDb(
        this.blkbrdDbSchema,
        // null,
        // null,
        // { verbose: console.log.bind(console) },
      );

      db.attachDatabaseToConnection(
        this.dbWriteConnection,
        this.targetMapSchema,
      );

      // FIXME: Was getting Database Locked error when running for the entire state.
      //        This did not happen when running for a County.
      //        This fixed the problem, but I don't understand why the error was
      //          happening in the first place.
      // @ts-ignore
      this.dbWriteConnection.unsafeMode(true);
      this.dbWriteConnection.pragma(
        `${this.blkbrdDbSchema}.journal_mode = WAL`,
      );
    }

    return this.connections.dbWriteConnection;
  }

  beginWriteTransaction() {
    this.dbWriteConnection.exec('BEGIN');
  }

  commitWriteTransaction() {
    this.dbWriteConnection.exec('COMMIT');
  }

  rollbackWriteTransaction() {
    this.dbWriteConnection.exec('ROLLBACK');
  }

  protected get databaseHasBeenInitializedStmt(): Statement {
    if (!this.preparedReadStatements.databaseHasBeenInitializedStmt) {
      this.preparedReadStatements.databaseHasBeenInitializedStmt = this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT
                name
              FROM ${this.blkbrdDbSchema}.sqlite_master WHERE type = 'table'
          ) ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.databaseHasBeenInitializedStmt;
  }

  protected get databaseHasBeenInitialized(): boolean {
    return this.databaseHasBeenInitializedStmt.raw().get()[0] === 1;
  }

  protected get initializeShstMatchesTableSql() {
    return createShstMatchesTableSql.replace(
      /__SCHEMA__/g,
      this.blkbrdDbSchema,
    );
  }

  protected initializeShstMatchesTable() {
    this.dbWriteConnection.exec(this.initializeShstMatchesTableSql);
  }

  protected get initializeChosenMatchesTableSql() {
    return createChosenMatchesTableSql.replace(
      /__SCHEMA__/g,
      this.blkbrdDbSchema,
    );
  }

  protected initializeChosenMatchesTable() {
    this.dbWriteConnection.exec(this.initializeChosenMatchesTableSql);
  }

  protected get initializeAssignedMatchesTableSql() {
    return createAssignedMatchesTableSql.replace(
      /__SCHEMA__/g,
      this.blkbrdDbSchema,
    );
  }

  protected initializeAssignedMatchesTable() {
    this.dbWriteConnection.exec(this.initializeAssignedMatchesTableSql);
  }

  get targetMapIsCenterline() {
    return this.targetMapDao.targetMapIsCenterline;
  }

  get targetMapPathsAreEulerian() {
    return this.targetMapDao.targetMapPathsAreEulerian;
  }

  get shstMatchesTableExistsStmt(): Statement {
    this.preparedReadStatements.shstMatchesTableExistsStmt =
      this.preparedReadStatements.shstMatchesTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
              SELECT 1
                FROM ${this.blkbrdDbSchema}.sqlite_master
                WHERE (
                  ( type = 'table' )
                  AND
                  ( name = 'target_map_edges_shst_matches' )
                )
            ) ;
        `,
      );

    return this.preparedReadStatements.shstMatchesTableExistsStmt;
  }

  protected get shstMatchesAreLoadedStmt(): Statement {
    this.preparedReadStatements.shstMatchesAreLoadedStmt =
      this.preparedReadStatements.shstMatchesAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT
                1
              FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches
          ) ;`,
      );

    return this.preparedReadStatements.shstMatchesAreLoadedStmt;
  }

  get shstMatchesAreLoaded(): boolean {
    return (
      this.shstMatchesTableExistsStmt.pluck().get() === 1 &&
      this.shstMatchesAreLoadedStmt.pluck().get() === 1
    );
  }

  protected get insertMatchSql() {
    return `
      INSERT OR IGNORE INTO ${this.blkbrdDbSchema}.target_map_edges_shst_matches (
        edge_id,
        shst_reference,
        section_start,
        section_end,
        feature_len_km,
        feature
      ) VALUES (?, ?, ?, ?, ?, json(?)) ;
    `;
  }

  protected get insertShstMatchStmt(): Statement {
    if (!this.preparedWriteStatements.insertShstMatchStmt) {
      this.preparedWriteStatements.insertShstMatchStmt = this.dbWriteConnection.prepare(
        this.insertMatchSql,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertShstMatchStmt;
  }

  protected insertShstMatch(
    shstMatch: SharedStreetsMatchResult,
  ): SharedStreetsMatchFeature['id'] | null {
    const {
      properties: {
        shstReferenceId,
        section: [section_start, section_end],
        pp_id: edgeId,
      },
    } = shstMatch;

    const featureLenKm = _.round(turf.length(shstMatch), 6);

    const { changes, lastInsertRowid } = this.insertShstMatchStmt.run([
      `${edgeId}`,
      `${shstReferenceId}`,
      `${section_start}`,
      `${section_end}`,
      `${featureLenKm}`,
      `${JSON.stringify(shstMatch)}`,
    ]);

    if (changes === 0) {
      return null;
    }

    const shstMatchId = +lastInsertRowid;

    return shstMatchId;
  }

  async bulkLoadShstMatches(
    shstMatchesIter: AsyncGenerator<SharedStreetsMatchResult, void, unknown>,
  ) {
    try {
      this.beginWriteTransaction();

      this.initializeShstMatchesTable();

      for await (const shstMatch of shstMatchesIter) {
        this.insertShstMatch(shstMatch);
      }

      this.initializeChosenMatchesTable();
      this.initializeAssignedMatchesTable();

      this.commitWriteTransaction();
    } catch (err) {
      this.rollbackWriteTransaction();
      console.error(err);
    }
  }

  protected get allShstMatchFeaturesStmt(): Statement {
    if (!this.preparedReadStatements.allShstMatchFeaturesStmt) {
      this.preparedReadStatements.allShstMatchFeaturesStmt = this.dbReadConnection.prepare(
        `
          SELECT
              json_set(
                feature,
                '$.id',
                shst_match_id
              ) as shst_match_feature
            FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.allShstMatchFeaturesStmt;
  }

  *makeAllShstMatchesIterator(): Generator<turf.Feature<turf.LineString>> {
    const iter = this.allShstMatchFeaturesStmt.raw().iterate();

    for (const [featureStr] of iter) {
      const feature = JSON.parse(featureStr);

      yield feature;
    }
  }

  protected get shstMatchMetadataByTargetMapIdStmt(): Statement {
    if (!this.preparedReadStatements.shstMatchMetadataByTargetMapIdStmt) {
      this.preparedReadStatements.shstMatchMetadataByTargetMapIdStmt = this.dbReadConnection.prepare(
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
            FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches
              INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
                USING (edge_id)
            GROUP BY target_map_id
          ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.shstMatchMetadataByTargetMapIdStmt;
  }

  *makeShstMatchMetadataByTargetMapIdIterator(): Generator<{
    targetMapId: RawTargetMapFeature['id'];
    shstMatchesMetadata: SharedStreetsMatchMetadata[];
  }> {
    const iter = this.shstMatchMetadataByTargetMapIdStmt.raw().iterate();

    for (const [targetMapId, shstMatchesMetadataStr] of iter) {
      const shstMatchesMetadata = JSON.parse(shstMatchesMetadataStr);

      yield { targetMapId, shstMatchesMetadata };
    }
  }

  protected get clearShstMatchesStmt(): Statement {
    if (!this.preparedWriteStatements.clearShstMatchesStmt) {
      this.preparedWriteStatements.clearShstMatchesStmt = this.dbWriteConnection.prepare(
        `DELETE FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches;`,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.clearShstMatchesStmt;
  }

  clearShstMatches() {
    this.clearShstMatchesStmt.run();
  }

  /**
    NOTE: Only TargetMapPathEdges within the induced subnet are included
          in the result set. TargetMapPathEdges that are outside of subnet
          are not considerd part of the TargetMapPath in this context.
          This is so that TargetMapPathEdges will have nearby TargetMapEdges,
          even if in the complete TargetMap those edges are part of the same path.
    */
  protected get shstMatchesForPathStmt(): Statement {
    if (!this.preparedReadStatements.shstMatchesForPathStmt) {
      this.preparedReadStatements.shstMatchesForPathStmt = this.dbReadConnection.prepare(
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
                    '$.properties.targetMapPathIdx', -- NOTE: In induced subnets, may start > 0.
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
                  FROM ${this.targetMapSchema}.target_map_ppg_path_edges
                    LEFT OUTER JOIN ${this.blkbrdDbSchema}.target_map_edges_shst_matches AS matches
                      USING (edge_id)
                  GROUP BY path_id, path_edge_idx, edge_id
              ) AS agg_path_matches
                INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_line_features AS ppg_edges
                  USING (edge_id)
            WHERE (path_id = ?)
          ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.shstMatchesForPathStmt;
  }

  // FIXME: Need to (optionally?) split noncontinuous paths
  //        if subnet induction removes internal path edges.
  getTargetMapPathShstMatches(targetMapPathId: TargetMapPathId) {
    // We get the matches on-demand so that the chooser can insert matches as needed.
    //  EG: Match mutations or gap-filling "matches"
    const unorderedTargetMapEdgeMatchesStr = this.shstMatchesForPathStmt
      .raw()
      .get([targetMapPathId]);

    if (!unorderedTargetMapEdgeMatchesStr) {
      return { targetMapPathId, targetMapPathMatches: null };
    }

    // Guaranteed to be grouped by path_id, however
    //  the order of the edges along the path is not guaranteed.
    const unorderedTargetMapEdgeMatches: TargetMapEdgeShstMatches[] = JSON.parse(
      unorderedTargetMapEdgeMatchesStr,
    );

    const getPathEdgeIdx = (x: any) =>
      _.get(x, ['targetMapPathEdge', 'properties', 'targetMapPathIdx']);

    // Sort by the path edges topologically.
    const orderedTargetMapEdgeMatches = unorderedTargetMapEdgeMatches.sort(
      (a, b) => getPathEdgeIdx(a) - getPathEdgeIdx(b),
    );

    const targetMapPathMatches = orderedTargetMapEdgeMatches.map((e) =>
      _.omit(e, 'path_id'),
    );

    return { targetMapPathId, targetMapPathMatches };
  }

  makeTargetMapPathIdsIterator() {
    return this.targetMapDao.makeTargetMapPathIdsIterator();
  }

  *makeTargetMapPathMatchesIterator(queryParams?: {
    targetMapPathIds: Generator<TargetMapPathId> | Array<TargetMapPathId>;
  }): TargetMapPathMatchesIterator {
    const pathIdsIter =
      queryParams?.targetMapPathIds ?? this.makeTargetMapPathIdsIterator();

    for (const targetMapPathId of pathIdsIter) {
      yield this.getTargetMapPathShstMatches(targetMapPathId);
    }
  }

  protected get shstMatchesForTargetMapEdgesStmt(): Statement {
    if (!this.preparedReadStatements.shstMatchesForTargetMapEdgesStmt) {
      this.preparedReadStatements.shstMatchesForTargetMapEdgesStmt = this.dbReadConnection.prepare(
        `
          SELECT
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
            FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches AS matches
            WHERE (
              edge_id IN (
                SELECT
                    value AS edge_id
                  FROM (
                    SELECT json(?) AS tmap_edge_id_arr
                  ) AS t, json_each(t.tmap_edge_id_arr)
              )
            )
            GROUP BY edge_id ; `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.shstMatchesForTargetMapEdgesStmt;
  }

  getVicinityTargetMapEdgesShstMatches(
    boundingPolyCoords: number[][],
    queryParams: { excludedTargetMapEdges?: number[] },
  ): TargetMapEdgeShstMatches[] {
    const targetMapEdges = this.targetMapDao.getTargetMapEdgesOverlappingPoly(
      boundingPolyCoords,
      queryParams,
    );

    const targetMapEdgeIds = targetMapEdges.map(({ id }) => id);

    const shstMatchesByTargetMapEdgeId = this.shstMatchesForTargetMapEdgesStmt
      .raw()
      .all([JSON.stringify(targetMapEdgeIds)])
      .reduce((acc, [targetMapEdgeId, shstMatchesStr]) => {
        acc[targetMapEdgeId] = JSON.parse(shstMatchesStr);
        return acc;
      }, {});

    const targetMapEdgesShstMatches = targetMapEdges.map((targetMapEdge) => ({
      targetMapEdge,
      shstMatches: shstMatchesByTargetMapEdgeId[targetMapEdge.id] || null,
    }));

    return targetMapEdgesShstMatches;
  }

  *makeChosenMatchReferencesIterator() {
    const chosenMatchesIter = this.makeChosenMatchesIterator();

    let shstReference: SharedStreetsReferenceFeature | null = null;
    for (const chosenMatch of chosenMatchesIter) {
      const { shstReferenceId, sectionStart, sectionEnd } = chosenMatch;

      if (!shstReference || shstReference.id !== shstReferenceId) {
        [shstReference] = SourceMapDao.getShstReferences([shstReferenceId]);
      }

      if (sectionStart < sectionEnd) {
        const slicedRef = turf.lineSliceAlong(
          shstReference,
          sectionStart,
          sectionEnd,
        );

        slicedRef.properties = chosenMatch;

        yield slicedRef;
      }
    }
  }

  protected get chosenMatchesTableExistsStmt(): Statement {
    this.preparedReadStatements.chosenMatchesTableExistsStmt =
      this.preparedReadStatements.chosenMatchesTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT 1
              FROM ${this.blkbrdDbSchema}.sqlite_master
              WHERE (
                ( type = 'table' )
                AND
                ( name = 'target_map_edge_chosen_matches' )
              )
          ) ;`,
      );

    return this.preparedReadStatements.chosenMatchesTableExistsStmt;
  }

  protected get chosenMatchesAreLoadedStmt(): Statement {
    this.preparedReadStatements.chosenMatchesAreLoadedStmt =
      this.preparedReadStatements.chosenMatchesAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT
                1
              FROM ${this.blkbrdDbSchema}.target_map_edge_chosen_matches
          ) ;`,
      );

    return this.preparedReadStatements.chosenMatchesAreLoadedStmt;
  }

  get chosenMatchesAreLoaded(): boolean {
    return (
      this.chosenMatchesTableExistsStmt.pluck().get() === 1 &&
      this.chosenMatchesAreLoadedStmt.pluck().get() === 1
    );
  }

  protected get insertChosenMatchStmt(): Statement {
    if (!this.preparedWriteStatements.insertChosenMatchStmt) {
      this.preparedWriteStatements.insertChosenMatchStmt = this.dbWriteConnection.prepare(
        `
          INSERT OR IGNORE INTO ${this.blkbrdDbSchema}.target_map_edge_chosen_matches (
            path_id,
            path_edge_idx,

            edge_id,
            is_forward,
            edge_shst_match_idx,

            shst_reference,
            section_start,
            section_end,

            along_edge_start,
            along_edge_end,

            avg_deviance_km
          )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ; `,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertChosenMatchStmt;
  }

  protected insertChosenMatch(
    chosenMatch: ChosenMatchMetadata,
  ): boolean | null {
    const {
      targetMapPathId,
      targetMapPathEdgeIdx,
      targetMapEdgeId,
      isForward,
      targetMapEdgeShstMatchIdx,
      shstReferenceId,
      sectionStart,
      sectionEnd,
      alongEdgeStart,
      alongEdgeEnd,
      avgDevianceKm,
    } = chosenMatch;

    const insertResult = this.insertChosenMatchStmt.run([
      targetMapPathId,
      targetMapPathEdgeIdx,
      targetMapEdgeId,
      +!!isForward,
      targetMapEdgeShstMatchIdx,
      shstReferenceId,
      sectionStart,
      sectionEnd,
      alongEdgeStart,
      alongEdgeEnd,
      avgDevianceKm,
    ]);

    if (insertResult.changes < 1 && sectionStart < sectionEnd) {
      console.log('ChosenMatch INSERT FAILED.');
      console.log(JSON.stringify({ chosenMatch }, null, 4));
    }

    return insertResult.changes > 0;
  }

  async bulkLoadChosenMatches(
    chosenMatchesIter: Generator<ChosenMatchMetadata, void, unknown>,
  ) {
    try {
      this.beginWriteTransaction();

      this.initializeChosenMatchesTable();

      for await (const chosenMatch of chosenMatchesIter) {
        this.insertChosenMatch(chosenMatch);
      }

      this.initializeAssignedMatchesTable();

      this.commitWriteTransaction();
    } catch (err) {
      this.rollbackWriteTransaction();
      console.error(err);
    }
  }

  protected get chosenMatchesPathStmt(): Statement {
    if (!this.preparedReadStatements.chosenMatchesPathStmt) {
      // TODO TODO TODO This belongs in a VIEW
      this.preparedReadStatements.chosenMatchesPathStmt = this.dbReadConnection.prepare(
        `
          SELECT
              json_group_array(
                json_object(
                  'targetMapId',
                  target_map_id,
                  'targetMapPathId',
                  path_id,
                  'targetMapEdgeId',
                  edge_id,
                  'isForward',
                  is_forward,
                  'edgeShstMatchIdx',
                  edge_shst_match_idx,
                  'shstReferenceId',
                  shst_reference,
                  'sectionStart',
                  section_start,
                  'sectionEnd',
                  section_end
                )
              )
            FROM ${this.blkbrdDbSchema}.target_map_edge_chosen_matches
              INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
              USING (edge_id)
            GROUP BY shst_reference
            ORDER BY shst_reference, section_start, section_end
          ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.chosenMatchesPathStmt;
  }

  *makeChosenMatchesIterator(): Generator<ChosenMatchMetadata> {
    const iter = this.chosenMatchesPathStmt.raw().iterate();

    for (const [chosenMatchesStr] of iter) {
      const chosenMatches = JSON.parse(chosenMatchesStr);

      for (let i = 0; i < chosenMatches.length; ++i) {
        const chosenMatch = chosenMatches[i];
        yield chosenMatch;
      }
    }
  }

  // FIXME: Currently doesn't take into account TargetMapPath
  protected get targetMapEdgesChosenMatchesStmt(): Statement {
    if (!this.preparedReadStatements.targetMapEdgesChosenMatchesStmt) {
      this.preparedReadStatements.targetMapEdgesChosenMatchesStmt = this.dbReadConnection.prepare(
        `
          SELECT
              json_object(
                -- The ID in the TargetMap
                'targetMapId',       target_map_id,

                -- TargetMapPPG IDs
                'targetMapPathId',   path_id,
                'targetMapEdgeId',   edge_id,

                'shstReferenceId',   shst_reference,

                'isForward',         is_forward,
                'edgeShstMatchIdx',  edge_shst_match_idx,

                'sectionStart',      section_start,
                'sectionEnd',        section_end
              ) AS chosen_match_metadata
            FROM ${this.blkbrdDbSchema}.target_map_edge_chosen_matches
              INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
                USING (edge_id)
            WHERE (
              -- FIXME: Needs to optionally filter by TargetMapPath
              edge_id IN (
                SELECT
                    value AS edge_id
                  FROM (
                    SELECT json(?) AS tmap_edge_id_arr
                  ) AS t, json_each(t.tmap_edge_id_arr)
              )
            )
          ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.targetMapEdgesChosenMatchesStmt;
  }

  // FIXME: Currently doesn't take into account TargetMapPath
  getChosenMatchesForTargetMapEdges(
    targetMapEdgeIds: TargetMapEdgeId[],
  ): ChosenMatchFeature[][] {
    const chosenMatchesMetadata: ChosenMatchMetadata[] = this.targetMapEdgesChosenMatchesStmt
      .raw()
      .all([JSON.stringify(targetMapEdgeIds)])
      .map((d) => JSON.parse(d));

    const shstReferenceIds = _(chosenMatchesMetadata)
      .map('shstReferenceId')
      .uniq()
      .value();

    const shstReferences = SourceMapDao.getShstReferences(shstReferenceIds);

    const shstReferencesById = shstReferences.reduce((acc, shstReference) => {
      const { id } = shstReference;

      acc[id] = shstReference;

      return acc;
    }, {});

    const chosenMatchFeaturesByTargetMapEdgeId: Record<
      TargetMapEdgeId,
      ChosenMatchFeature[]
    > = chosenMatchesMetadata.reduce(
      (
        acc: Record<TargetMapEdgeId, ChosenMatchFeature[]>,
        chosenMatchMetadata: ChosenMatchMetadata,
      ) => {
        const {
          targetMapEdgeId,
          shstReferenceId,
          sectionStart,
          sectionEnd,
        } = chosenMatchMetadata;

        // if (sectionEnd - sectionStart < MIN_CHOSEN_MATCH_LEN) {
        // return acc;
        // }

        const shstReference = shstReferencesById[shstReferenceId];

        // @ts-ignore
        const chosenMatch: ChosenMatchFeature = turf.lineSliceAlong(
          shstReference,
          sectionStart,
          sectionEnd,
          { units: 'kilometers' },
        );

        // @ts-ignore
        chosenMatch.properties = {
          shstReferenceId: shstReference.id,
          chosenMatchMetadata,
        };

        acc[targetMapEdgeId] = acc[targetMapEdgeId] || [];

        acc[targetMapEdgeId].push(chosenMatch);

        return acc;
      },
      {},
    );

    const toposorter = (a: ChosenMatchFeature, b: ChosenMatchFeature) =>
      a.properties.chosenMatchMetadata.targetMapEdgeShstMatchIdx -
      b.properties.chosenMatchMetadata.targetMapEdgeShstMatchIdx;

    const chosenMatchesForTargetMapEdges = targetMapEdgeIds.map(
      (targetMapEdgeId) =>
        chosenMatchFeaturesByTargetMapEdgeId[targetMapEdgeId]?.sort(
          toposorter,
        ) || [],
    );

    return chosenMatchesForTargetMapEdges;
  }

  get assignedMatchesTableExistsStmt(): Statement {
    this.preparedReadStatements.assignedMatchesTableExistsStmt =
      this.preparedReadStatements.assignedMatchesTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
              SELECT 1
                FROM ${this.blkbrdDbSchema}.sqlite_master
                WHERE (
                  ( type = 'table' )
                  AND
                  ( name = 'target_map_edge_assigned_matches' )
                )
            ) ;
        `,
      );

    return this.preparedReadStatements.assignedMatchesTableExistsStmt;
  }

  protected get assignedMatchesAreLoadedStmt(): Statement {
    this.preparedReadStatements.assignedMatchesAreLoadedStmt =
      this.preparedReadStatements.assignedMatchesAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT
                1
              FROM ${this.blkbrdDbSchema}.target_map_edge_assigned_matches
          ) ;`,
      );

    return this.preparedReadStatements.assignedMatchesAreLoadedStmt;
  }

  get assignedMatchesAreLoaded(): boolean {
    return (
      this.assignedMatchesTableExistsStmt.pluck().get() === 1 &&
      this.assignedMatchesAreLoadedStmt.pluck().get() === 1
    );
  }

  protected get insertAssignedMatchStmt(): Statement {
    this.preparedWriteStatements.insertAssignedMatchStmt =
      this.preparedWriteStatements.insertAssignedMatchStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT OR IGNORE INTO ${this.blkbrdDbSchema}.target_map_edge_assigned_matches (
            shst_reference_id,
            edge_id,
            is_forward,
            section_start,
            section_end
          )
            VALUES(?, ?, ?, ?, ?) ; `,
      );

    return this.preparedWriteStatements.insertAssignedMatchStmt;
  }

  protected insertAssignedMatch(assignedMatch: AssignedMatch): boolean | null {
    const {
      shstReferenceId,
      targetMapEdgeId,
      isForward,
      sectionStart,
      sectionEnd,
    } = assignedMatch;

    const insertResult = this.insertAssignedMatchStmt.run([
      shstReferenceId,
      targetMapEdgeId,
      isForward,
      sectionStart,
      sectionEnd,
    ]);

    // @ts-ignore
    if (insertResult.changes < 1 && sectionStart < sectionEnd) {
      // console.log('AssignedMatch INSERT FAILED.');
      // console.log(JSON.stringify({ assignedMatch }, null, 4));
    }

    return insertResult.changes > 0;
  }

  bulkLoadAssignedMatches(assignedMatchesIter: Generator<AssignedMatch>) {
    try {
      this.beginWriteTransaction();

      this.initializeAssignedMatchesTable();

      for (const assignedMatch of assignedMatchesIter) {
        this.insertAssignedMatch(assignedMatch);
      }

      this.commitWriteTransaction();
    } catch (err) {
      this.rollbackWriteTransaction();
      console.error(err);
    }
  }

  protected get allTargetMapAssignedMatchesStmt(): Statement {
    this.preparedReadStatements.allTargetMapAssignedMatchesStmt =
      this.preparedReadStatements.allTargetMapAssignedMatchesStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              shst_reference_id AS shstReferenceId,
              target_map_id AS targetMapId,
              is_forward AS isForward,
              section_start AS sectionStart,
              section_end AS sectionEnd
            FROM ${this.blkbrdDbSchema}.target_map_edge_assigned_matches
              INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
                USING (edge_id)
            WHERE (
              ( section_start IS NOT NULL )
              AND
              ( section_end IS NOT NULL )
            )
            ORDER BY 1,2,3
        `,
      );

    return this.preparedReadStatements.allTargetMapAssignedMatchesStmt;
  }

  makeAssignedMatchesIterator(): Generator<TargetMapAssignedMatch> {
    // @ts-ignore
    return this.allTargetMapAssignedMatchesStmt.iterate();
  }

  protected get targetMapPathAssignedMatchesStats(): Statement {
    this.preparedReadStatements.targetMapPathAssignedMatchesStats =
      this.preparedReadStatements.targetMapPathAssignedMatchesStats ||
      this.dbReadConnection.prepare(
        `
          SELECT
              path_id,
              COUNT( DISTINCT a.edge_id ) AS total_edges,
              COUNT( DISTINCT
                IIF(
                  (
                    ( b.section_start IS NOT NULL )
                    AND
                    ( b.section_end IS NOT NULL )
                  ),
                  b.edge_id,
                  NULL
                )
              ) AS edges_with_assignments
            FROM ${this.targetMapSchema}.target_map_ppg_path_edges AS a
              LEFT OUTER JOIN ${this.blkbrdDbSchema}.target_map_edge_assigned_matches AS b
                USING (edge_id)
            GROUP BY path_id
            ORDER BY path_id
        `,
      );

    return this.preparedReadStatements.targetMapPathAssignedMatchesStats;
  }

  outputUnmatchedTargetMapPaths() {
    const stats = this.targetMapPathAssignedMatchesStats.iterate();

    for (const { path_id, edges_with_assignments } of stats) {
      if (edges_with_assignments === 0) {
        console.log(
          JSON.stringify(this.targetMapDao.getMergedTargetMapPath(path_id)),
        );
      }
    }
  }

  vacuumDatabase() {
    this.dbWriteConnection.exec(`VACUUM ${this.blkbrdDbSchema};`);
  }
}
