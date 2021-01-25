/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Statement } from 'better-sqlite3';

import * as turf from '@turf/turf';
import _ from 'lodash';

import db from '../../DbService';

import * as SourceMapDAO from '../../../daos/SourceMapDao';

import TargetMapDAO from '../../../utils/TargetMapDatabases/TargetMapDAO';

import {
  SharedStreetsMatchResult,
  SharedStreetsMatchFeature,
  SharedStreetsMatchMetadata,
  TargetMapSchema,
  TargetMapPathId,
  RawTargetMapFeatureFeature,
  TargetMapEdgeShstMatches,
  TargetMapPathMatchesIterator,
  SharedStreetsReferenceFeature,
} from '../domain/types';

const initializeSqlPath = join(
  __dirname,
  './initialize_blackboard_database.sql',
);

const initializeBlackBoardDatabaseTemplateSql = readFileSync(
  initializeSqlPath,
).toString();

export type QueryPolygon = turf.Feature<turf.Polygon>;

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
    shstMatchesForTargetMapEdgesStmt?: Statement;
  };

  bulkLoadChosenShstMatches: TargetMapDAO['bulkLoadShstMatches'];

  makeChosenShstMatchesIterator: TargetMapDAO['makeChosenShstMatchesIterator'];

  makeTargetMapEdgeFeaturesGeoProximityIterator: TargetMapDAO['makeTargetMapEdgesGeoproximityIterator'];

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

    this.bulkLoadChosenShstMatches = this.targetMapDao.bulkLoadShstMatches.bind(
      this.targetMapDao,
    );

    this.makeChosenShstMatchesIterator = this.targetMapDao.makeChosenShstMatchesIterator.bind(
      this.targetMapDao,
    );

    this.makeTargetMapEdgeFeaturesGeoProximityIterator = this.targetMapDao.makeTargetMapEdgesGeoproximityIterator.bind(
      this.targetMapDao,
    );
  }

  private get initializeBlackBoardDatabaseSql() {
    return initializeBlackBoardDatabaseTemplateSql.replace(
      /__SCHEMA__/g,
      this.blkbrdDbSchema,
    );
  }

  /**
   * WARNING: Drops all existing tables in the TargetMapDatabase.
   */
  initializeTargetMapConflationBlackBoardDatabase() {
    db.exec('BEGIN;');
    db.exec(this.initializeBlackBoardDatabaseSql);
    db.exec('COMMIT;');
  }

  get targetMapIsCenterline() {
    return this.targetMapDao.targetMapIsCenterline;
  }

  get targetMapPathsAreEulerian() {
    return this.targetMapDao.targetMapPathsAreEulerian;
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
    clean = false,
  ) {
    const xdb = db.openLoadingConnectionToDb(this.blkbrdDbSchema);

    try {
      // @ts-ignore
      xdb.unsafeMode(true);

      xdb.exec('BEGIN EXCLUSIVE;');

      if (clean) {
        xdb.exec(this.initializeBlackBoardDatabaseSql);
      }

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

  makeTargetMapPathIdsIterator() {
    return this.targetMapDao.makeTargetMapPathIdsIterator();
  }

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

    // console.log(JSON.stringify(targetMapPathMatches, null, 4));

    return { targetMapPathId, targetMapPathMatches };
  }

  *makeTargetMapPathMatchesIterator(queryParams?: {
    targetMapPathIds: TargetMapPathId[];
  }): TargetMapPathMatchesIterator {
    const pathIdsIter =
      queryParams?.targetMapPathIds ??
      this.targetMapDao.makeTargetMapPathIdsIterator();

    for (const targetMapPathId of pathIdsIter) {
      yield this.getTargetMapPathMatches(targetMapPathId);
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

    // foo
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

  vacuumDatabase() {
    db.exec(`VACUUM ${this.blkbrdDbSchema};`);
  }
}
