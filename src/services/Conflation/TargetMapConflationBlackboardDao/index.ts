/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';

import db, { DatabaseSchemaName, DatabaseDirectory } from '../../DbService';

import * as SourceMapDAO from '../../../daos/SourceMapDao';

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
} from '../domain/types';

// const MIN_CHOSEN_MATCH_LEN = 0.005; [> km, 5m <]

export type TargetMapConflationBlackboardDaoConfig = {
  databaseDirectory?: DatabaseDirectory | null;
  databaseSchemaName?: DatabaseSchemaName | null;
};

const initializeSqlPath = join(
  __dirname,
  './initialize_blackboard_database.sql',
);

const initializeBlackBoardDatabaseTemplateSql = readFileSync(
  initializeSqlPath,
).toString();

export default class TargetMapConflationBlackboardDao<
  T extends RawTargetMapFeature
> {
  readonly targetMapSchema: TargetMapSchema;

  protected readonly targetMapDao: TargetMapDAO<T>;

  readonly blkbrdDbSchema: DatabaseSchemaName;

  readonly databaseDirectory: DatabaseDirectory | null;

  // Used for reads
  readonly dbReadConnection: Database;

  // Used for writes
  readonly dbWriteConnection: Database;

  protected readonly preparedReadStatements: {
    databaseHasBeenInitializedStmt?: Statement;
    shstMatchesAreLoadedStmt?: Statement;
    allShstMatchFeaturesStmt?: Statement;
    shstMatchMetadataByTargetMapIdStmt?: Statement;
    shstMatchesForPathStmt?: Statement;
    shstMatchesForTargetMapEdgesStmt?: Statement;
    chosenShstMatchesPathStmt?: Statement;
  };

  protected readonly preparedWriteStatements: {
    insertShstMatchStmt?: Statement;
    clearShstMatchesStmt?: Statement;
    insertChosenShstMatchStmt?: Statement;
  };

  makeTargetMapEdgeFeaturesGeoProximityIterator: TargetMapDAO<
    T
  >['makeTargetMapEdgesGeoproximityIterator'];

  constructor(
    targetMapSchema: TargetMapSchema,
    protected config: TargetMapConflationBlackboardDaoConfig = {},
  ) {
    this.targetMapSchema = targetMapSchema;
    this.blkbrdDbSchema =
      config.databaseSchemaName ||
      `${this.targetMapSchema}_conflation_blackboard`;

    this.databaseDirectory = config.databaseDirectory || null;

    this.dbReadConnection = db.openConnectionToDb(
      this.blkbrdDbSchema,
      this.databaseDirectory,
      // { verbose: console.log.bind(console) },
    );

    db.attachDatabaseToConnection(this.dbReadConnection, this.targetMapSchema);

    // Write connection strictly for writes to this DB.
    this.dbWriteConnection = db.openConnectionToDb(
      this.blkbrdDbSchema,
      this.databaseDirectory,
      // { verbose: console.log.bind(console) },
    );
    db.attachDatabaseToConnection(this.dbWriteConnection, this.targetMapSchema);

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};

    this.targetMapDao = new TargetMapDAO(this.targetMapSchema);

    if (!this.databaseHasBeenInitialized) {
      this.beginWriteTransaction();
      this.initializeTargetMapConflationBlackBoardDatabase();
      this.commitWriteTransaction();
    }

    this.makeTargetMapEdgeFeaturesGeoProximityIterator = this.targetMapDao.makeTargetMapEdgesGeoproximityIterator.bind(
      this.targetMapDao,
    );
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

  protected get initializeBlackBoardDatabaseSql() {
    return initializeBlackBoardDatabaseTemplateSql.replace(
      /__SCHEMA__/g,
      this.blkbrdDbSchema,
    );
  }

  /**
   * WARNING: Drops all existing tables in the TargetMapDatabase.
   */
  initializeTargetMapConflationBlackBoardDatabase() {
    this.dbWriteConnection.exec(this.initializeBlackBoardDatabaseSql);
  }

  get targetMapIsCenterline() {
    return this.targetMapDao.targetMapIsCenterline;
  }

  get targetMapPathsAreEulerian() {
    return this.targetMapDao.targetMapPathsAreEulerian;
  }

  protected get shstMatchesAreLoadedStmt(): Statement {
    if (!this.preparedReadStatements.shstMatchesAreLoadedStmt) {
      this.preparedReadStatements.shstMatchesAreLoadedStmt = this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT
                1
              FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches
          ) ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.shstMatchesAreLoadedStmt;
  }

  get shstMatchesAreLoaded(): boolean {
    return this.shstMatchesAreLoadedStmt.raw().get()[0] === 1;
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
    clean = false,
  ) {
    if (clean) {
      this.initializeTargetMapConflationBlackBoardDatabase();
    }

    for await (const shstMatch of shstMatchesIter) {
      this.insertShstMatch(shstMatch);
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

  *makeAllShstMatchesIterator(): Generator<
    turf.Feature<turf.LineString | turf.MultiLineString>
  > {
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
  getTargetMapPathMatches(targetMapPathId: TargetMapPathId) {
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
      yield this.getTargetMapPathMatches(targetMapPathId);
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

  *makeChosenShstMatchReferencesIterator() {
    const chosenMatchesIter = this.makeChosenShstMatchesIterator();

    let shstReference: SharedStreetsReferenceFeature | null = null;
    for (const chosenMatch of chosenMatchesIter) {
      const { shstReferenceId, sectionStart, sectionEnd } = chosenMatch;

      if (!shstReference || shstReference.id !== shstReferenceId) {
        [shstReference] = SourceMapDAO.getShstReferences([shstReferenceId]);
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

  protected get insertChosenShstMatchStmt(): Statement {
    if (!this.preparedWriteStatements.insertChosenShstMatchStmt) {
      this.preparedWriteStatements.insertChosenShstMatchStmt = this.dbWriteConnection.prepare(
        `
          -- INSERT OR IGNORE INTO ${this.blkbrdDbSchema}.target_map_edge_chosen_shst_matches (
          INSERT OR IGNORE INTO ${this.blkbrdDbSchema}.target_map_edge_chosen_shst_matches (
            edge_id,
            is_forward,
            edge_shst_match_idx,
            shst_reference,
            section_start,
            section_end
          )
            VALUES(?, ?, ?, ?, ?, ?) ; `,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.insertChosenShstMatchStmt;
  }

  protected insertChosenShstMatch(
    chosenShstMatch: ChosenMatchMetadata,
  ): boolean | null {
    const {
      targetMapEdgeId,
      isForward,
      targetMapEdgeShstMatchIdx,
      shstReferenceId,
      sectionStart,
      sectionEnd,
    } = chosenShstMatch;

    const insertResult = this.insertChosenShstMatchStmt.run([
      targetMapEdgeId,
      +!!isForward,
      targetMapEdgeShstMatchIdx,
      shstReferenceId,
      sectionStart,
      sectionEnd,
    ]);

    if (insertResult.changes < 1) {
      console.log('ChosenMatch INSERT FAILED.');
      // console.log(JSON.stringify(insertResult, null, 4));
    }

    return insertResult.changes > 0;
  }

  async bulkLoadChosenShstMatches(
    chosenShstMatchesIter: Generator<ChosenMatchMetadata, void, unknown>,
  ) {
    this.dbWriteConnection
      .prepare(
        `DELETE FROM ${this.blkbrdDbSchema}.target_map_edge_chosen_shst_matches;`,
      )
      .run();

    for await (const chosenShstMatch of chosenShstMatchesIter) {
      this.insertChosenShstMatch(chosenShstMatch);
    }
  }

  protected get chosenShstMatchesPathStmt(): Statement {
    if (!this.preparedReadStatements.chosenShstMatchesPathStmt) {
      // TODO TODO TODO This belongs in a VIEW
      this.preparedReadStatements.chosenShstMatchesPathStmt = this.dbReadConnection.prepare(
        `
          SELECT
              json_group_array(
                json_object(
                  'targetMapId',
                  target_map_id,
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
            FROM ${this.blkbrdDbSchema}.target_map_edge_chosen_shst_matches
              INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
              USING (edge_id)
            GROUP BY shst_reference
            ORDER BY shst_reference, section_start, section_end
          ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.chosenShstMatchesPathStmt;
  }

  *makeChosenShstMatchesIterator(): Generator<ChosenMatchMetadata> {
    const iter = this.chosenShstMatchesPathStmt.raw().iterate();

    for (const [chosenMatchesStr] of iter) {
      const chosenMatches = JSON.parse(chosenMatchesStr);

      for (let i = 0; i < chosenMatches.length; ++i) {
        const chosenMatch = chosenMatches[i];
        yield chosenMatch;
      }
    }
  }

  protected get targetMapEdgesChosenMatchesStmt(): Statement {
    if (!this.preparedReadStatements.targetMapEdgesChosenMatchesStmt) {
      this.preparedReadStatements.targetMapEdgesChosenMatchesStmt = this.dbReadConnection.prepare(
        `
          SELECT
              json_object(
                'targetMapId',       target_map_id,
                'targetMapEdgeId',   edge_id,

                'shstReferenceId',   shst_reference,

                'isForward',         is_forward,
                'edgeShstMatchIdx',  edge_shst_match_idx,

                'sectionStart',      section_start,
                'sectionEnd',        section_end
              ) AS chosen_match_metadata
            FROM ${this.blkbrdDbSchema}.target_map_edge_chosen_shst_matches
              INNER JOIN ${this.targetMapSchema}.target_map_ppg_edge_id_to_target_map_id
                USING (edge_id)
            WHERE (
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

  getChosenShstMatchesForTargetMapEdges(
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

    const shstReferences = SourceMapDAO.getShstReferences(shstReferenceIds);

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

  vacuumDatabase() {
    this.dbWriteConnection.exec(`VACUUM ${this.blkbrdDbSchema};`);
  }
}
