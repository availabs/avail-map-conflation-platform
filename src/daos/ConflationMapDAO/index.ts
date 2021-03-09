/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

// import * as turf from '@turf/turf';

import { Database, Statement } from 'better-sqlite3';

import db, {
  DatabaseSchemaName,
  DatabaseDirectory,
} from '../../services/DbService';

import TargetMapConflationBlackboardDao from '../../services/Conflation/TargetMapConflationBlackboardDao';

// import { getGeometriesConcaveHull } from '../../utils/gis/hulls';

import getChosenShstReferenceSegmentsForOsmWay from './getChosenShstReferenceSegmentsForOsmWay';

import {
  CONFLATION_MAP as SCHEMA,
  SOURCE_MAP,
  NPMRDS,
  NYS_RIS,
} from '../../constants/databaseSchemaNames';

import {
  OsmNodeId,
  OsmWayId,
  SharedStreetsRoadClass,
  SharedStreetsReferenceFeature,
} from '../SourceMapDao/domain/types';

// const albanyCounty: turf.Feature<turf.Polygon> = JSON.parse(
//   readFileSync(join(__dirname, './albanyCounty.geojson'), { encoding: 'utf8' }),
// );

const NPMRDS_CONFLATION_SCHEMA = TargetMapConflationBlackboardDao.getBlackboardSchemaName(
  NPMRDS,
);

const NYS_RIS_CONFLATION_SCHEMA = TargetMapConflationBlackboardDao.getBlackboardSchemaName(
  NYS_RIS,
);

export type TargetMapConflationBlackboardDaoConfig = {
  databaseDirectory?: DatabaseDirectory | null;
  databaseSchemaName?: DatabaseSchemaName | null;
};

const initializeSqlPath = join(__dirname, './initialize_database.sql');

const initializeDatabaseSql = readFileSync(initializeSqlPath)
  .toString()
  .replace(/__SCHEMA__/g, SCHEMA);

export default class ConflationMapDAO {
  // Used for reads
  readonly dbReadConnection: Database;

  // Used for writes
  readonly dbWriteConnection: Database;

  protected readonly preparedReadStatements: {
    databaseHasBeenInitializedStmt?: Statement;
    osmWayChosenMatchesAreLoadedStmt?: Statement;
    getOsmNodesStmt?: Statement;
    allOsmWaysWithShstReferencesStmt?: Statement;
  };

  protected readonly preparedWriteStatements: {
    truncateChosenShstReferenceSegmentsForOsmWaysStmt?: Statement;
    insertChosenShstReferenceSegmentForOsmWayStmt?: Statement;
  };

  constructor() {
    this.dbReadConnection = db.openConnectionToDb(SCHEMA);

    db.attachDatabaseToConnection(this.dbReadConnection, SOURCE_MAP);
    db.attachDatabaseToConnection(this.dbReadConnection, NPMRDS);
    db.attachDatabaseToConnection(
      this.dbReadConnection,
      NPMRDS_CONFLATION_SCHEMA,
    );
    db.attachDatabaseToConnection(this.dbReadConnection, NYS_RIS);
    db.attachDatabaseToConnection(
      this.dbReadConnection,
      NYS_RIS_CONFLATION_SCHEMA,
    );

    // Write connection strictly for writes to this DB.
    this.dbWriteConnection = db.openConnectionToDb(
      SCHEMA,
      // null,
      // { verbose: console.log.bind(console) },
    );

    db.attachDatabaseToConnection(this.dbWriteConnection, SOURCE_MAP);

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};

    if (!this.databaseHasBeenInitialized) {
      this.beginWriteTransaction();
      try {
        this.initializeTheDatabase();

        console.time('loadChosenShstReferenceSegmentsForOsmWays');
        this.loadChosenShstReferenceSegmentsForOsmWays();
        console.timeEnd('loadChosenShstReferenceSegmentsForOsmWays');

        this.commitWriteTransaction();
      } catch (err) {
        this.rollbackWriteTransaction();
        console.error(err);
        process.exit(1);
      }
      this.vacuumDatabase();
    }
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
              FROM ${SCHEMA}.sqlite_master WHERE type = 'table'
          ) ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.databaseHasBeenInitializedStmt;
  }

  protected get databaseHasBeenInitialized(): boolean {
    return this.databaseHasBeenInitializedStmt.pluck().get() === 1;
  }

  /**
   * WARNING: Drops all existing tables in the TargetMapDatabase.
   */
  initializeTheDatabase() {
    this.dbWriteConnection.exec(initializeDatabaseSql);
  }

  protected loadOsmWaysToShstReferencesTable() {
    this.dbWriteConnection
      .prepare(
        `
          INSERT INTO ${SCHEMA}.osm_ways_to_shst_references
        `,
      )
      .run();
  }

  protected get osmWayChosenMatchesAreLoadedStmt(): Statement {
    if (!this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt) {
      this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt = this.dbReadConnection.prepare(
        `
          SELECT EXISTS (
            SELECT
                1
              FROM ${SCHEMA}.osm_way_chosen_shst_matches
          ) ;`,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt;
  }

  get osmWayChosenMatchesAreLoaded(): boolean {
    return this.osmWayChosenMatchesAreLoadedStmt.pluck().get() === 1;
  }

  protected get allOsmWaysWithShstReferencesStmt(): Statement {
    this.preparedReadStatements.allOsmWaysWithShstReferencesStmt =
      this.preparedReadStatements.allOsmWaysWithShstReferencesStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              a.osm_way_id,
              a.osm_node_ids,
              json_group_array(
                json(c.feature)
              ) AS shst_refs
            FROM ${SOURCE_MAP}.osm_ways AS a
              INNER JOIN (
                SELECT DISTINCT
                    json_extract(t.value, '$.way_id') AS osm_way_id,
                    shst_reference_id
                  FROM ${SOURCE_MAP}.shst_reference_features,
                    json_each(
                      json_extract(feature, '$.properties.osmMetadataWaySections')
                    ) AS t
                  WHERE (
                    json_extract(feature, '$.properties.minOsmRoadClass') < ${SharedStreetsRoadClass.Other}
                  )
              ) AS b USING (osm_way_id)
              INNER JOIN ${SOURCE_MAP}.shst_reference_features AS c
                USING (shst_reference_id)
              -- INNER JOIN (
              --   SELECT
              --       shst_reference_id
              --     FROM ${SOURCE_MAP}.shst_reference_features_geopoly_idx
              --     WHERE geopoly_overlap(_shape, ?)
              -- ) USING ( shst_reference_id )
            WHERE (
              json_extract(feature, '$.properties.minOsmRoadClass') < ${SharedStreetsRoadClass.Other}
            )
            GROUP BY osm_way_id
            ORDER BY osm_way_id ;
        `,
      );

    return this.preparedReadStatements.allOsmWaysWithShstReferencesStmt;
  }

  *makeOsmWaysWithShstReferencesIterator(): Generator<{
    osmWayId: OsmWayId;
    osmNodeIds: OsmNodeId[];
    shstReferences: SharedStreetsReferenceFeature[];
  }> {
    // const boundingPolyHull = getGeometriesConcaveHull([albanyCounty]);
    // const [boundingPolyCoords] = turf.getCoords(boundingPolyHull);

    const iter = this.allOsmWaysWithShstReferencesStmt.raw().iterate();
    // .iterate([JSON.stringify(boundingPolyCoords)]);

    for (const [osmWayId, osmNodeIdsStr, shstRefsStr] of iter) {
      const osmNodeIds = JSON.parse(osmNodeIdsStr);
      const shstReferences = JSON.parse(shstRefsStr);

      yield { osmWayId, osmNodeIds, shstReferences };
    }
  }

  protected get truncateChosenShstReferenceSegmentsForOsmWaysStmt(): Statement {
    this.preparedWriteStatements.truncateChosenShstReferenceSegmentsForOsmWaysStmt =
      this.preparedWriteStatements
        .truncateChosenShstReferenceSegmentsForOsmWaysStmt ||
      this.dbWriteConnection.prepare(
        `DELETE FROM ${SCHEMA}.osm_way_chosen_shst_matches;`,
      );

    // @ts-ignore
    return this.preparedWriteStatements
      .truncateChosenShstReferenceSegmentsForOsmWaysStmt;
  }

  protected get insertChosenShstReferenceSegmentForOsmWayStmt(): Statement {
    this.preparedWriteStatements.insertChosenShstReferenceSegmentForOsmWayStmt =
      this.preparedWriteStatements
        .insertChosenShstReferenceSegmentForOsmWayStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO ${SCHEMA}.osm_way_chosen_shst_matches(
            osm_way_id,
            is_forward,

            shst_reference_id,

            osm_way_nodes_start_idx,
            osm_way_nodes_end_idx,

            section_start,
            section_end
          ) VALUES(?, ?, ?, ?, ?, ?, ?) ;
        `,
      );

    // @ts-ignore
    return this.preparedWriteStatements
      .insertChosenShstReferenceSegmentForOsmWayStmt;
  }

  loadChosenShstReferenceSegmentsForOsmWays() {
    this.truncateChosenShstReferenceSegmentsForOsmWaysStmt.run();

    const iter = this.makeOsmWaysWithShstReferencesIterator();

    for (const { osmWayId, osmNodeIds, shstReferences } of iter) {
      const {
        chosenForward,
        chosenBackward,
      } = getChosenShstReferenceSegmentsForOsmWay({
        osmWayId,
        osmNodeIds,
        shstReferences,
      });

      for (let i = 0; i < chosenForward.length; ++i) {
        const {
          shstReferenceId,
          osmNodesStartIdx,
          osmNodesEndIdx,
          sectionStart,
          sectionEnd,
        } = chosenForward[i];

        try {
          this.insertChosenShstReferenceSegmentForOsmWayStmt.run([
            osmWayId,
            1,
            shstReferenceId,
            osmNodesStartIdx,
            osmNodesEndIdx,
            sectionStart,
            sectionEnd,
          ]);
        } catch (err) {
          console.log(JSON.stringify(chosenForward[i], null, 4));
          throw err;
        }
      }

      for (let i = 0; i < chosenBackward.length; ++i) {
        const {
          shstReferenceId,
          osmNodesStartIdx,
          osmNodesEndIdx,
          sectionStart,
          sectionEnd,
        } = chosenBackward[i];

        try {
          this.insertChosenShstReferenceSegmentForOsmWayStmt.run([
            osmWayId,
            0,
            shstReferenceId,
            osmNodesStartIdx,
            osmNodesEndIdx,
            sectionStart,
            sectionEnd,
          ]);
        } catch (err) {
          console.log(JSON.stringify(chosenBackward[i], null, 4));
          throw err;
        }
      }
    }
  }

  vacuumDatabase() {
    this.dbWriteConnection.exec(`VACUUM ${SCHEMA}; `);
  }
}
