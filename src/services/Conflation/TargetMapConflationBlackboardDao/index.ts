/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Statement } from 'better-sqlite3';

import * as turf from '@turf/turf';
import _ from 'lodash';

import db from '../../DbService';

import TargetMapDAO, {
  RawTargetMapFeatureFeature,
  TargetMapPathId,
  TargetMapSchema,
} from '../../../utils/TargetMapDatabases/TargetMapDAO';

import {
  SharedStreetsMatchResult,
  SharedStreetsMatchFeature,
  SharedStreetsMatchMetadata,
  TargetMapEdgeShstMatches,
  TargetMapPathMatchesIterator,
  TargetMapPathChosenMatches,
} from './domain/types';

export * from './domain/types';

const initializeSqlPath = join(
  __dirname,
  './initialize_blackboard_database.sql',
);

const initializeBlackBoardDatabaseTemplateSql = readFileSync(
  initializeSqlPath,
).toString();

export default class TargetMapConflationBlackboardDao {
  readonly targetMapSchema: TargetMapSchema;

  private readonly targetMapDao: TargetMapDAO;

  readonly blkbrdDbSchema: string;

  private readonly preparedStatements: {
    shstMatchesAreLoadedStmt?: Statement;
    insertShstMatchStmt?: Statement;
    allShstMatchFeaturesStmt?: Statement;
    shstMatchMetadataByTargetMapIdStmt?: Statement;
    clearShstMatchesStmt?: Statement;
    shstMatchesForPathStmt?: Statement;
    insertPathChosenMatchesStmt?: Statement;
    insertPathChosenMatchesMetadataStmt?: Statement;
    truncatePathChosenMatchesStmt?: Statement;
    truncateEdgeChosenMatchesStmt?: Statement;
    insertOptimalTargetMapEdgeChosenMatchesStmt?: Statement;
    targetMapEdgesChosenMatchesStmt?: Statement;
    shstMatchesForTargetMapEdgesStmt?: Statement;
  };

  constructor(targetMapSchema: TargetMapSchema) {
    this.targetMapSchema = targetMapSchema;
    this.blkbrdDbSchema = `${this.targetMapSchema}_conflation_blackboard`;

    this.targetMapDao = new TargetMapDAO(db, this.targetMapSchema);

    const dbHasBeenInitialized = db.databaseFileExists(this.blkbrdDbSchema);

    db.attachDatabase(this.blkbrdDbSchema);

    if (!dbHasBeenInitialized) {
      this.initializeTargetMapConflationBlackBoardDatabase();
    }

    this.preparedStatements = {};
  }

  /**
   * WARNING: Drops all existing tables in the TargetMapDatabase.
   */
  initializeTargetMapConflationBlackBoardDatabase() {
    const sql = initializeBlackBoardDatabaseTemplateSql.replace(
      /__SCHEMA__/g,
      this.blkbrdDbSchema,
    );

    db.exec('BEGIN;');
    db.exec(sql);
    db.exec('COMMIT;');
  }

  get targetMapIsCenterline() {
    return this.targetMapDao.targetMapIsCenterline;
  }

  makeTargetMapEdgeFeaturesGeoProximityIterator() {
    return this.targetMapDao.makeTargetMapEdgesGeoproximityIterator();
  }

  private get shstMatchesAreLoadedStmt(): Statement {
    if (!this.preparedStatements.shstMatchesAreLoadedStmt) {
      this.preparedStatements.shstMatchesAreLoadedStmt = db.prepare(
        `
          SELECT EXISTS (
            SELECT
                1
              FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches
          ) ;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.shstMatchesAreLoadedStmt;
  }

  get shstMatchesAreLoaded(): boolean {
    return this.shstMatchesAreLoadedStmt.raw().get()[0] === 1;
  }

  private get insertMatchSql() {
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

  private get insertShstMatchStmt(): Statement {
    if (!this.preparedStatements.insertShstMatchStmt) {
      this.preparedStatements.insertShstMatchStmt = db.prepare(
        this.insertMatchSql,
      );
    }

    // @ts-ignore
    return this.preparedStatements.insertShstMatchStmt;
  }

  private xInsertShstMatch(
    shstMatch: SharedStreetsMatchResult,
    insertShstMatchStmt: Statement = this.insertShstMatchStmt,
  ): SharedStreetsMatchFeature['id'] | null {
    const {
      properties: {
        shstReferenceId,
        section: [section_start, section_end],
        pp_id: edgeId,
      },
    } = shstMatch;

    const featureLenKm = _.round(turf.length(shstMatch), 6);

    const { changes, lastInsertRowid } = insertShstMatchStmt.run([
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

  insertShstMatch(
    shstMatch: SharedStreetsMatchResult,
  ): SharedStreetsMatchFeature['id'] | null {
    return this.xInsertShstMatch(shstMatch);
  }

  async bulkLoadShstMatches(
    shstMatchesIter: AsyncGenerator<SharedStreetsMatchResult, void, unknown>,
  ) {
    const xdb = db.openLoadingConnectionToDb(this.blkbrdDbSchema);

    try {
      // @ts-ignore
      xdb.unsafeMode(true);

      xdb.exec('BEGIN EXCLUSIVE;');

      const xInsertStmt = xdb.prepare(this.insertMatchSql);

      for await (const shstMatch of shstMatchesIter) {
        this.xInsertShstMatch(shstMatch, xInsertStmt);
      }

      xdb.exec('COMMIT');
    } catch (err) {
      xdb.exec('ROLLBACK;');
      throw err;
    } finally {
      db.closeLoadingConnectionToDb(xdb);
    }
  }

  private get allShstMatchFeaturesStmt(): Statement {
    if (!this.preparedStatements.allShstMatchFeaturesStmt) {
      this.preparedStatements.allShstMatchFeaturesStmt = db.prepare(
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
      this.preparedStatements.shstMatchMetadataByTargetMapIdStmt = db.prepare(
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

  private get clearShstMatchesStmt(): Statement {
    if (!this.preparedStatements.clearShstMatchesStmt) {
      this.preparedStatements.clearShstMatchesStmt = db.prepare(
        `DELETE FROM ${this.blkbrdDbSchema}.target_map_edges_shst_matches;`,
      );
    }

    // @ts-ignore
    return this.preparedStatements.clearShstMatchesStmt;
  }

  clearShstMatches() {
    this.clearShstMatchesStmt.run();
  }

  private get shstMatchesForPathStmt(): Statement {
    if (!this.preparedStatements.shstMatchesForPathStmt) {
      // TODO TODO TODO This belongs in a VIEW
      this.preparedStatements.shstMatchesForPathStmt = db.prepare(
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
                  FROM ${this.targetMapSchema}.target_map_ppg_path_edges AS ppg_paths
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
    return this.preparedStatements.shstMatchesForPathStmt;
  }

  *makeTargetMapPathMatchesIterator(queryParams?: {
    pathIds: TargetMapPathId[];
  }): TargetMapPathMatchesIterator {
    const pathIdsIter =
      queryParams?.pathIds ?? this.targetMapDao.makeTargetMapPathIdsIterator();

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

      yield { targetMapPathId, targetMapPathMatches };
    }
  }

  private get insertPathChosenMatchesMetadataStmt() {
    if (!this.preparedStatements.insertPathChosenMatchesMetadataStmt) {
      this.preparedStatements.insertPathChosenMatchesMetadataStmt = db.prepare(
        `
          INSERT INTO ${this.blkbrdDbSchema}.target_map_paths_shst_match_chains_metadata (
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
      this.preparedStatements.insertPathChosenMatchesStmt = db.prepare(
        `
          INSERT INTO ${this.blkbrdDbSchema}.target_map_paths_shst_match_chains (
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
      this.preparedStatements.truncatePathChosenMatchesStmt = db.prepare(
        `
          DELETE FROM ${this.blkbrdDbSchema}.target_map_paths_shst_match_chains_metadata ;
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
      this.preparedStatements.truncateEdgeChosenMatchesStmt = db.prepare(
        `
          DELETE FROM ${this.blkbrdDbSchema}.target_map_paths_edge_optimal_matches ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedStatements.truncateEdgeChosenMatchesStmt;
  }

  private get insertOptimalTargetMapEdgeChosenMatchesStmt() {
    if (!this.preparedStatements.insertOptimalTargetMapEdgeChosenMatchesStmt) {
      this.preparedStatements.insertOptimalTargetMapEdgeChosenMatchesStmt = db.prepare(
        `
          INSERT INTO ${this.blkbrdDbSchema}.target_map_paths_edge_optimal_matches
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
                    INNER JOIN ${this.targetMapSchema}.target_map_ppg_path_edges
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
      this.preparedStatements.targetMapEdgesChosenMatchesStmt = db.prepare(
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
            FROM ${this.blkbrdDbSchema}.target_map_edge_chosen_matches
              INNER JOIN ${this.blkbrdDbSchema}.target_map_ppg_edge_id_to_target_map_id
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

  private get shstMatchesForTargetMapEdgesStmt(): Statement {
    if (!this.preparedStatements.shstMatchesForTargetMapEdgesStmt) {
      // TODO TODO TODO This belongs in a VIEW
      this.preparedStatements.shstMatchesForTargetMapEdgesStmt = db.prepare(
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
    return this.preparedStatements.shstMatchesForTargetMapEdgesStmt;
  }

  // FIXME should return TargetMapEdgeShstMatches
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
      .all([targetMapEdgeIds])
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

  vacuumDatabase() {
    db.exec(`VACUUM ${this.blkbrdDbSchema};`);
  }
}
