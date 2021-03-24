/* eslint-disable no-restricted-syntax */

/*
    FIXME:
      This module MUST work if ONLY the final conflation_map SQLite database is present.
      It MUST NOT depend on any input or intermediate pipeline stage SQLite databases.
      It currently depends on the existence of the source_map SQLite database.
*/

import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import { Database as SQLiteDatbase, Statement } from 'better-sqlite3';

import db, {
  DatabaseSchemaName,
  DatabaseDirectory,
} from '../../services/DbService';

import TargetMapConflationBlackboardDao from '../../services/Conflation/TargetMapConflationBlackboardDao';

// import { getGeometriesConcaveHull } from '../../utils/gis/hulls';

import getChosenShstReferenceSegmentsForOsmWay from './utils/getChosenShstReferenceSegmentsForOsmWay';
import partitionShstReference from './utils/partitionShstReference';
import createMBTiles from './utils/createMBTiles';
import outputShapefile from './utils/outputShapefile';

import {
  CONFLATION_MAP as SCHEMA,
  SOURCE_MAP,
  NYS_RIS,
} from '../../constants/databaseSchemaNames';

import {
  OsmNodeId,
  OsmWayId,
  SharedStreetsRoadClass,
  SharedStreetsReferenceFeature,
} from '../SourceMapDao/domain/types';

import { NysRoadInventorySystemFeature } from '../NysRisDAO/raw_map_layer/domain/types';
import { NpmrdsTmcFeature } from '../NpmrdsDAO/raw_map_layer/domain/types';

import {
  TargetMap,
  ShstReferenceTargetMapEdgesAssignment,
  ShstReferenceTargetMapsAssignments,
  ConflationMapSegment,
} from './domain/types';

import getFederalDirection from './utils/getFederalDirection';

export type TargetMapConflationBlackboardDaoConfig = {
  databaseDirectory?: DatabaseDirectory | null;
  databaseSchemaName?: DatabaseSchemaName | null;
};

const NYS_RIS_BB = TargetMapConflationBlackboardDao.getBlackboardSchemaName(
  NYS_RIS,
);

// const albanyCounty: turf.Feature<turf.Polygon> = JSON.parse(
// readFileSync(join(__dirname, './geojson/albanyCounty.geojson'), {
// encoding: 'utf8',
// }),
// );

function createDbReadConnection(): SQLiteDatbase {
  const dbReadConnection = db.openConnectionToDb(SCHEMA);

  db.attachDatabaseToConnection(dbReadConnection, SOURCE_MAP);

  return dbReadConnection;
}

function createDbWriteConnection(): SQLiteDatbase {
  const dbWriteConnection = db.openConnectionToDb(SCHEMA);

  db.attachDatabaseToConnection(dbWriteConnection, SOURCE_MAP);
  db.attachDatabaseToConnection(dbWriteConnection, NYS_RIS);
  db.attachDatabaseToConnection(dbWriteConnection, NYS_RIS_BB);

  dbWriteConnection.function(
    'getFederalDirection',
    { deterministic: true },
    getFederalDirection,
  );

  return dbWriteConnection;
}

export default class ConflationMapDAO {
  nysRisBBDao!: TargetMapConflationBlackboardDao<NysRoadInventorySystemFeature>;

  npmrdsBBDao!: TargetMapConflationBlackboardDao<NpmrdsTmcFeature>;

  // Used for reads
  readonly dbReadConnection: SQLiteDatbase;

  // Used for writes
  readonly dbWriteConnection: SQLiteDatbase;

  protected readonly preparedReadStatements: {
    nysRisAssignedMatchesTableExistsStmt?: Statement;
    npmrdsAssignedMatchesTableExistsStmt?: Statement;
    nysRisAssignedMatchesAreLoadedStmt?: Statement;
    npmrdsAssignedMatchesAreLoadedStmt?: Statement;
    osmWayChosenMatchesTableExistsStmt?: Statement;
    osmWayChosenMatchesAreLoadedStmt?: Statement;
    targetMapAssignedMatchesTableExistsStmt?: Statement;
    targetMapAssignedMatchesAreLoadedStmt?: Statement;
    getOsmNodesStmt?: Statement;
    allOsmWaysWithShstReferencesStmt?: Statement;
    shstReferenceTargetMapsAssignmentsStmt?: Statement;
    conflationMapSegmentsTableExistsStmt?: Statement;
    conflationMapSegmentsAreLoadedStmt?: Statement;
    conflationMapSegmentsStmt?: Statement;
  };

  protected readonly preparedWriteStatements: {
    insertChosenShstReferenceSegmentForOsmWayStmt?: Statement;
    loadOsmWayAssignedMatchesTableStmt?: Statement;
    insertTargetMapAssignedMatchStmt?: Statement;
    insertConflationMapSegmentStmt?: Statement;
  };

  constructor() {
    this.dbReadConnection = createDbReadConnection();
    this.dbWriteConnection = createDbWriteConnection();

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};

    /*
    if (!this.osmWayChosenMatchesAreLoaded) {
      try {
        console.log('loadOsmWayChosenMatchesTable');
        console.time('loadOsmWayChosenMatchesTable');
        this.loadOsmWayChosenMatchesTable();
        console.timeEnd('loadOsmWayChosenMatchesTable');
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }

    if (!this.targetMapAssignedMatchesAreLoaded) {
      try {
        this.nysRisBBDao = new TargetMapConflationBlackboardDao(NYS_RIS);
        this.npmrdsBBDao = new TargetMapConflationBlackboardDao(NPMRDS);

        this.verifyTargetMapsConflationComplete();
        console.log('loadTargetMapsAssignedMatches');
        console.time('loadTargetMapsAssignedMatches');
        this.loadTargetMapsAssignedMatches();
        console.timeEnd('loadTargetMapsAssignedMatches');
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }

    if (!this.conflationMapSegmentsAreLoaded) {
      try {
        // FIXME: Why is this needed?
        //        loadConflationMapSegments real slow, even with DROP/CREATE TABLE.
        this.dbWriteConnection.pragma(`${SCHEMA}.journal_mode = WAL`);

        console.log('loadConflationMapSegments');
        console.time('loadConflationMapSegments');
        this.loadConflationMapSegments();
        console.timeEnd('loadConflationMapSegments');
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
    */
  }

  close() {
    this.dbReadConnection.close();
    this.dbWriteConnection.close();
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

  verifyTargetMapsConflationComplete(): void | never {
    const incompleteTargetMapConflations: String[] = [];

    if (!this.nysRisBBDao.assignedMatchesAreLoaded) {
      incompleteTargetMapConflations.push('NYS_RIS');
    }

    if (!this.npmrdsBBDao.assignedMatchesAreLoaded) {
      incompleteTargetMapConflations.push('NPMRDS');
    }

    if (incompleteTargetMapConflations.length) {
      const plural = incompleteTargetMapConflations.length > 1;

      const maps = `${incompleteTargetMapConflations.join(' and ')}`;
      const conjugation = plural ? 's are' : ' is';

      const errorMessage = `Error: The ${maps} conflation${conjugation} not complete`;

      throw new Error(errorMessage);
    }
  }

  protected get osmWayChosenMatchesTableExistsStmt(): Statement {
    this.preparedReadStatements.osmWayChosenMatchesTableExistsStmt =
      this.preparedReadStatements.osmWayChosenMatchesTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM ${SCHEMA}.sqlite_master
              WHERE(
                (type = 'table')
                AND
                (name = 'osm_way_chosen_matches')
              )
          ) ;
        `,
      );

    return this.preparedReadStatements.osmWayChosenMatchesTableExistsStmt;
  }

  protected get osmWayChosenMatchesAreLoadedStmt(): Statement {
    this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt =
      this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM ${SCHEMA}.osm_way_chosen_matches
          );
        `,
      );

    return this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt;
  }

  get osmWayChosenMatchesAreLoaded(): boolean {
    return (
      this.osmWayChosenMatchesTableExistsStmt.pluck().get() === 1 &&
      this.osmWayChosenMatchesAreLoadedStmt.pluck().get() === 1
    );
  }

  private createTempAllOsmWaysWithShstReferencesTable() {
    this.dbWriteConnection.exec(`
      DROP TABLE IF EXISTS ${SCHEMA}.tmp_all_osm_ways_with_shst_references ;

      CREATE TABLE ${SCHEMA}.tmp_all_osm_ways_with_shst_references (
        osm_way_id    INTEGER PRIMARY KEY,
        osm_node_ids  TEXT NOT NULL, -- JSON
        shst_refs     TEXT NOT NULL
      ) WITHOUT ROWID;

      INSERT INTO ${SCHEMA}.tmp_all_osm_ways_with_shst_references
        SELECT
            a.osm_way_id,
            a.osm_node_ids,
            json_group_array(
              DISTINCT json(b.feature)
            ) AS shst_refs

        FROM ${SOURCE_MAP}.osm_ways AS a

          INNER JOIN(
            SELECT
                json_extract(t.value, '$.way_id') AS osm_way_id,
                feature

              FROM ${SOURCE_MAP}.shst_reference_features,
                json_each(
                  json_extract(feature, '$.properties.osmMetadataWaySections')
                ) AS t
              WHERE(
                json_extract(feature, '$.properties.minOsmRoadClass') < ${SharedStreetsRoadClass.Other}
              )
            ) AS b USING(osm_way_id)

        GROUP BY osm_way_id ;
    `);
  }

  protected get allOsmWaysWithShstReferencesStmt(): Statement {
    this.preparedReadStatements.allOsmWaysWithShstReferencesStmt =
      this.preparedReadStatements.allOsmWaysWithShstReferencesStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              osm_way_id,
              osm_node_ids,
              shst_refs
            FROM tmp_all_osm_ways_with_shst_references
            ORDER BY 1 ;
        `,
      );

    /*
    this.dbReadConnection.prepare(
      `
        SELECT
            a.osm_way_id,
            a.osm_node_ids,
            json_group_array(
              DISTINCT json(b.feature)
            ) AS shst_refs

        FROM ${SOURCE_MAP}.osm_ways AS a

          INNER JOIN(
            SELECT
                json_extract(t.value, '$.way_id') AS osm_way_id,
                feature

              FROM ${SOURCE_MAP}.shst_reference_features,
                json_each(
                  json_extract(feature, '$.properties.osmMetadataWaySections')
                ) AS t
              WHERE(
                json_extract(feature, '$.properties.minOsmRoadClass') < ${SharedStreetsRoadClass.Other}
              )
            ) AS b USING(osm_way_id)

        GROUP BY osm_way_id

        ORDER BY osm_way_id;
    `,
    );
    */

    return this.preparedReadStatements.allOsmWaysWithShstReferencesStmt;
  }

  *makeOsmWaysWithShstReferencesIterator(): Generator<{
    osmWayId: OsmWayId;
    osmNodeIds: OsmNodeId[];
    shstReferences: SharedStreetsReferenceFeature[];
  }> {
    console.log('makeOsmWaysWithShstReferencesIterator');
    // @ts-ignore
    // const boundingPolyHull = getGeometriesConcaveHull([albanyCounty]);
    // const [boundingPolyCoords] = turf.getCoords(boundingPolyHull);

    const iter = this.allOsmWaysWithShstReferencesStmt.raw().iterate();
    // .iterate([JSON.stringify(boundingPolyCoords)]);

    let logIterTime = true;
    console.timeEnd('  iter start');
    for (const [osmWayId, osmNodeIdsStr, shstRefsStr] of iter) {
      if (logIterTime) {
        console.time('  iter start');
        logIterTime = false;
      }

      const osmNodeIds = JSON.parse(osmNodeIdsStr);
      const shstReferences = JSON.parse(shstRefsStr);

      yield { osmWayId, osmNodeIds, shstReferences };
    }
  }

  protected get insertChosenShstReferenceSegmentForOsmWayStmt(): Statement {
    this.preparedWriteStatements.insertChosenShstReferenceSegmentForOsmWayStmt =
      this.preparedWriteStatements
        .insertChosenShstReferenceSegmentForOsmWayStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO ${SCHEMA}.osm_way_chosen_matches(
            osm_way_id,
            is_forward,

            shst_reference_id,

            osm_way_nodes_start_idx,
            osm_way_nodes_end_idx,

            section_start,
            section_end
          ) VALUES(?, ?, ?, ?, ?, ?, ?);
      `,
      );

    return this.preparedWriteStatements
      .insertChosenShstReferenceSegmentForOsmWayStmt;
  }

  protected createOsmChosenMatchesTable() {
    const createOsmWayChosenMatchesTableSQL = readFileSync(
      join(__dirname, './sql/create_osm_way_chosen_matches_table.sql'),
      { encoding: 'utf-8' },
    ).replace(/__SCHEMA__/g, SCHEMA);

    this.dbWriteConnection.exec(createOsmWayChosenMatchesTableSQL);
  }

  loadOsmWayChosenMatchesTable() {
    try {
      this.dbWriteConnection.exec('BEGIN;');
      console.time('createTempAllOsmWaysWithShstReferencesTable');
      this.createTempAllOsmWaysWithShstReferencesTable();
      console.timeEnd('createTempAllOsmWaysWithShstReferencesTable');
      this.dbWriteConnection.exec('COMMIT;');

      this.dbWriteConnection.exec('BEGIN;');

      this.createOsmChosenMatchesTable();

      console.time('makeOsmWaysWithShstReferencesIterator');
      const iter = this.makeOsmWaysWithShstReferencesIterator();

      let ct = 0;
      console.time('next');
      for (const { osmWayId, osmNodeIds, shstReferences } of iter) {
        console.timeEnd('next');
        if (ct === 0) {
          console.timeEnd('makeOsmWaysWithShstReferencesIterator');
        }

        console.log();
        console.log(++ct, osmWayId);

        console.time('getChosenShstReferenceSegmentsForOsmWay');
        const {
          chosenForward,
          chosenBackward,
        } = getChosenShstReferenceSegmentsForOsmWay({
          osmWayId,
          osmNodeIds,
          shstReferences,
        });
        console.timeEnd('getChosenShstReferenceSegmentsForOsmWay');

        console.time('insert forward');
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
        console.timeEnd('insert forward');

        console.time('insert backward');
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
        console.timeEnd('insert backward');
        console.time('next');
      }

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      this.dbWriteConnection.exec('ROLLBACK');
      throw err;
    }
  }

  protected createTargetMapsAssignedMatchesTable() {
    const sql = readFileSync(
      join(__dirname, './sql/create_target_map_assigned_matches_table.sql'),
      { encoding: 'utf-8' },
    ).replace(/__SCHEMA__/g, SCHEMA);

    this.dbWriteConnection.exec(sql);
  }

  protected get targetMapAssignedMatchesTableExistsStmt(): Statement {
    this.preparedReadStatements.targetMapAssignedMatchesTableExistsStmt =
      this.preparedReadStatements.targetMapAssignedMatchesTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
                  FROM ${SCHEMA}.sqlite_master
                  WHERE(
              (type = 'table')
                    AND
                (name = 'target_maps_assigned_matches')
            )
          ) ;
        `,
      );

    return this.preparedReadStatements.targetMapAssignedMatchesTableExistsStmt;
  }

  protected get targetMapAssignedMatchesAreLoadedStmt(): Statement {
    this.preparedReadStatements.targetMapAssignedMatchesAreLoadedStmt =
      this.preparedReadStatements.targetMapAssignedMatchesAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT
                    1
                  FROM ${SCHEMA}.target_maps_assigned_matches
          );
        `,
      );

    return this.preparedReadStatements.targetMapAssignedMatchesAreLoadedStmt;
  }

  get targetMapAssignedMatchesAreLoaded(): boolean {
    return (
      this.targetMapAssignedMatchesTableExistsStmt.pluck().get() === 1 &&
      this.targetMapAssignedMatchesAreLoadedStmt.pluck().get() === 1
    );
  }

  protected get loadOsmWayAssignedMatchesTableStmt(): Statement {
    this.preparedWriteStatements.loadOsmWayAssignedMatchesTableStmt =
      this.preparedWriteStatements.loadOsmWayAssignedMatchesTableStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO ${SCHEMA}.target_maps_assigned_matches (
            shst_reference_id,
            target_map,
            target_map_id,
            is_forward,
            section_start,
            section_end
          )
            SELECT
                shst_reference_id,
                '${TargetMap.OSM}' AS target_map,
                osm_way_id,
                is_forward,
                section_start,
                section_end

              FROM ${SCHEMA}.osm_way_chosen_matches ;
        `,
      );

    return this.preparedWriteStatements.loadOsmWayAssignedMatchesTableStmt;
  }

  protected loadOsmWayAssignedMatchesTable() {
    this.loadOsmWayAssignedMatchesTableStmt.run();
  }

  protected get insertTargetMapAssignedMatchStmt(): Statement {
    this.preparedWriteStatements.insertTargetMapAssignedMatchStmt =
      this.preparedWriteStatements.insertTargetMapAssignedMatchStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO ${SCHEMA}.target_maps_assigned_matches (
            shst_reference_id,
            target_map,
            target_map_id,
            is_forward,
            section_start,
            section_end
          ) VALUES (?, ?, ?, ?, ?, ?) ;
        `,
      );

    return this.preparedWriteStatements.insertTargetMapAssignedMatchStmt;
  }

  loadTargetMapsAssignedMatches() {
    try {
      this.beginWriteTransaction();

      this.createTargetMapsAssignedMatchesTable();

      this.loadOsmWayAssignedMatchesTable();

      for (const {
        shstReferenceId,
        targetMapId,
        isForward,
        sectionStart,
        sectionEnd,
      } of this.nysRisBBDao.makeAssignedMatchesIterator()) {
        this.insertTargetMapAssignedMatchStmt.run([
          shstReferenceId,
          TargetMap.NYS_RIS,
          targetMapId,
          isForward,
          sectionStart,
          sectionEnd,
        ]);
      }

      for (const {
        shstReferenceId,
        targetMapId,
        isForward,
        sectionStart,
        sectionEnd,
      } of this.npmrdsBBDao.makeAssignedMatchesIterator()) {
        this.insertTargetMapAssignedMatchStmt.run([
          shstReferenceId,
          TargetMap.NPMRDS,
          targetMapId,
          isForward,
          sectionStart,
          sectionEnd,
        ]);
      }

      this.commitWriteTransaction();
    } catch (err) {
      this.rollbackWriteTransaction();
      throw err;
    }
  }

  protected get shstReferenceTargetMapsAssignmentsStmt(): Statement {
    this.preparedReadStatements.shstReferenceTargetMapsAssignmentsStmt =
      this.preparedReadStatements.shstReferenceTargetMapsAssignmentsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              feature as shst_reference,
              json_group_object(
                target_map,
                json(asgmts)
              ) as target_map_asgmts
            FROM ${SOURCE_MAP}.shst_reference_features
              INNER JOIN (
                SELECT
                    shst_reference_id,
                    target_map,
                    json_group_array(
                      json_object(
                        'targetMapId',   target_map_id,
                        'isForward',     is_forward,
                        'sectionStart',  section_start,
                        'sectionEnd',    section_end
                      )
                    ) AS asgmts

                  FROM ${SCHEMA}.target_maps_assigned_matches

                  WHERE ( (section_end - section_start) > 0.0001 )

                  GROUP BY shst_reference_id, target_map
              )
                USING (shst_reference_id)

            GROUP BY shst_reference_id ;
        `,
      );

    return this.preparedReadStatements.shstReferenceTargetMapsAssignmentsStmt;
  }

  *makeShstReferenceAssignedMatchesIterator(): Generator<{
    shstReference: SharedStreetsReferenceFeature;
    assignments: ShstReferenceTargetMapsAssignments;
  }> {
    console.log('make iter');
    const iter = this.shstReferenceTargetMapsAssignmentsStmt.raw().iterate();

    let i = 0;
    console.time('query');
    for (const [shstRefStr, asgmtsStr] of iter) {
      if (i++ === 0) {
        console.timeEnd('query');
      }
      const shstReference: SharedStreetsReferenceFeature = JSON.parse(
        shstRefStr,
      );
      const assignments: Record<
        TargetMap,
        ShstReferenceTargetMapEdgesAssignment
      > = JSON.parse(asgmtsStr);

      Object.keys(assignments).forEach((targetMap) =>
        assignments[targetMap].sort(
          (
            a: ShstReferenceTargetMapEdgesAssignment,
            b: ShstReferenceTargetMapEdgesAssignment,
          ) => a.sectionStart - b.sectionStart,
        ),
      );

      // FIXME: The TargetMapConflation process MUST take care of this.
      Object.keys(assignments).forEach((targetMap) =>
        assignments[targetMap].forEach(
          (asgmt: ShstReferenceTargetMapEdgesAssignment) => {
            // eslint-disable-next-line no-param-reassign
            asgmt.sectionStart = Math.max(asgmt.sectionStart, 0);
            // eslint-disable-next-line no-param-reassign
            asgmt.sectionEnd = Math.min(
              asgmt.sectionEnd,
              shstReference.properties.shstReferenceLength,
            );

            if (
              targetMap === TargetMap.OSM ||
              targetMap === TargetMap.NYS_RIS
            ) {
              // eslint-disable-next-line no-param-reassign
              asgmt.targetMapId = +asgmt.targetMapId;
            }
          },
        ),
      );

      // @ts-ignore
      yield { shstReference, assignments };
    }
  }

  *makePartitionedShstReferencesIterator() {
    const iter = this.makeShstReferenceAssignedMatchesIterator();

    for (const { shstReference, assignments } of iter) {
      const partitions = partitionShstReference(shstReference, assignments);

      for (let i = 0; i < partitions.length; ++i) {
        yield partitions[i];
      }
    }
  }

  protected get conflationMapSegmentsTableExistsStmt(): Statement {
    this.preparedReadStatements.conflationMapSegmentsTableExistsStmt =
      this.preparedReadStatements.conflationMapSegmentsTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM ${SCHEMA}.sqlite_master
              WHERE(
                (type = 'table')
                AND
                (name = 'conflation_map_segments')
              )
          ) ;
        `,
      );

    return this.preparedReadStatements.conflationMapSegmentsTableExistsStmt;
  }

  protected get conflationMapSegmentsAreLoadedStmt(): Statement {
    this.preparedReadStatements.conflationMapSegmentsAreLoadedStmt =
      this.preparedReadStatements.conflationMapSegmentsAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM ${SCHEMA}.conflation_map_segments
          );
        `,
      );

    return this.preparedReadStatements.conflationMapSegmentsAreLoadedStmt;
  }

  get conflationMapSegmentsAreLoaded(): boolean {
    return (
      this.conflationMapSegmentsTableExistsStmt.pluck().get() === 1 &&
      this.conflationMapSegmentsAreLoadedStmt.pluck().get() === 1
    );
  }

  protected createConflationMapSegmentsTable() {
    const createConflationMapSegmentsTableSQL = readFileSync(
      join(__dirname, './sql/create_conflation_map_segments_table.sql'),
      { encoding: 'utf-8' },
    ).replace(/__SCHEMA__/g, SCHEMA);

    this.dbWriteConnection.exec(createConflationMapSegmentsTableSQL);
  }

  protected get insertConflationMapSegmentStmt() {
    this.preparedWriteStatements.insertConflationMapSegmentStmt =
      this.preparedWriteStatements.insertConflationMapSegmentStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO ${SCHEMA}.conflation_map_segments(
            id,
            shst,
            shst_reference_length,
            road_class,
            partition_start_dist,
            partition_end_dist,
            osm,
            nys_ris,
            npmrds
          ) VALUES(?, ?, ?, ?, ?, ?, json(?), json(?), json(?));
      `,
      );

    return this.preparedWriteStatements.insertConflationMapSegmentStmt;
  }

  loadConflationMapSegments() {
    try {
      this.beginWriteTransaction();

      this.createConflationMapSegmentsTable();

      let i = 0;
      for (const conflationMapSegment of this.makePartitionedShstReferencesIterator()) {
        const {
          shst,
          shstReferenceLength,
          roadClass,
          partitionStartDist,
          partitionStopDist,
          osm,
          nys_ris,
          npmrds,
        } = conflationMapSegment.properties;

        this.insertConflationMapSegmentStmt.run([
          ++i,
          shst,
          shstReferenceLength,
          roadClass,
          partitionStartDist,
          partitionStopDist,
          JSON.stringify(osm),
          nys_ris ? JSON.stringify(nys_ris) : null,
          npmrds ? JSON.stringify(npmrds) : null,
        ]);
      }

      this.commitWriteTransaction();
    } catch (err) {
      console.error(err);
      this.rollbackWriteTransaction();
    }
  }

  protected get conflationMapSegmentsStmt(): Statement {
    this.preparedReadStatements.conflationMapSegmentsStmt =
      this.preparedReadStatements.conflationMapSegmentsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              json_group_array(
                json_object(
                  'id',                           id,
                  'shstReferenceId',              shst,
                  'shstReferenceLength',          shst_reference_length,
                  'roadClass',                    road_class,
                  'partitionStartDist',           partition_start_dist,
                  'partitionStopDist',            partition_end_dist,
                  'osm',                          json(osm),
                  'nys_ris',                      json(b.nys_ris),
                  'npmrds',                       json(npmrds),

                  'tdsRcStation',                 tds_rc_station,
                  'tdsFederalDirection',          tds_federal_direction,
                  'roadNumber',                   road_number,
                  'roadNumberFederalDirection',   road_number_federal_direction
                )
              ) AS segments,
              feature AS shst_reference

            FROM source_map.shst_reference_features AS a
              INNER JOIN ${SCHEMA}.conflation_map_segments AS b
                ON ( a.shst_reference_id = b.shst )
              LEFT OUTER JOIN ${SCHEMA}.ris_assigned_match_federal_directions AS c
                ON (
                  ( json_extract(b.nys_ris, '$.targetMapId') = c.nys_ris )
                  AND
                  ( json_extract(b.nys_ris, '$.isForward') = c.is_forward )
                )

            GROUP BY shst_reference_id
        `,
      );

    return this.preparedReadStatements.conflationMapSegmentsStmt;
  }

  *makeConflationMapSegmentsIterator(): Generator<ConflationMapSegment> {
    const iter = this.conflationMapSegmentsStmt.raw().iterate();

    for (const [segmentsStr, shstRefsStr] of iter) {
      const segments = JSON.parse(segmentsStr);
      const shstReference = JSON.parse(shstRefsStr);

      segments.sort(
        (a: any, b: any) => a.partitionStartDist - b.partitionStopDist,
      );

      for (let i = 0; i < segments.length; ++i) {
        const segment = segments[i];

        const feature = turf.lineSliceAlong(
          shstReference,
          segment.partitionStartDist,
          segment.partitionStopDist,
        );

        feature.id = segment.id;
        feature.properties = segment;

        // @ts-ignore
        yield feature;
      }
    }
  }

  loadRisAssignedMatchFederalDirectionsTable() {
    this.dbWriteConnection.exec(
      `
          BEGIN;

          DROP TABLE IF EXISTS ${SCHEMA}.ris_assigned_match_federal_directions ;

          CREATE TABLE ${SCHEMA}.ris_assigned_match_federal_directions (
            nys_ris                         TEXT,
            is_forward                      INTEGER,

            tds_rc_station                  TEXT,
            tds_federal_direction           INTEGER,

            road_number                     INTEGER,
            road_number_federal_direction   INTEGER,

            PRIMARY KEY(nys_ris, is_forward)
          ) ;

          INSERT INTO ${SCHEMA}.ris_assigned_match_federal_directions (
              nys_ris,
              is_forward,
              tds_rc_station,
              tds_federal_direction,
              road_number,
              road_number_federal_direction
            )
            SELECT
                 target_map_id AS nys_ris,
                 is_forward,

                 tds_rc_station,
                 getFederalDirection(
                   target_map_path_bearing,
                   is_forward,
                   tds_federal_directions
                 ) AS tds_federal_direction,

                 road_number,
                 getFederalDirection(
                   target_map_path_bearing,
                   is_forward,
                   CASE
                     WHEN ( road_number % 2 = 1) THEN '[1,5]'
                     WHEN ( road_number % 2 = 0) THEN '[3,7]'
                     ELSE NULL
                   END
                 ) AS road_number_federal_direction
               FROM (
                 SELECT DISTINCT
                     e.target_map_id,
                     d.is_forward,
                     json_extract(a.properties, '$.targetMapPathBearing') AS target_map_path_bearing,
                     json_extract(feature, '$.properties.tds_rc_station') AS tds_rc_station,
                     json_extract(feature, '$.properties.tds_federal_directions') AS tds_federal_directions,
                     NULLIF(json_extract(feature, '$.properties.route_no'), 0) AS road_number,
                     rank() OVER (
                       PARTITION BY
                         e.target_map_id,
                         d.is_forward
                       ORDER BY
                         b.path_edge_idx DESC
                     ) AS path_len_rnk
                   FROM ${NYS_RIS}.target_map_ppg_paths AS a
                     INNER JOIN ${NYS_RIS}.target_map_ppg_path_last_edges AS b
                       USING (path_id)
                     INNER JOIN ${NYS_RIS_BB}.target_map_edge_chosen_matches AS c
                       USING (path_id)
                     INNER JOIN ${NYS_RIS_BB}.target_map_edge_assigned_matches AS d
                       ON (
                         ( c.edge_id = d.edge_id )
                         AND
                         ( c.is_forward = d.is_forward )
                         AND
                         ( c.shst_reference = d.shst_reference_id)
                       )
                     INNER JOIN ${NYS_RIS}.target_map_ppg_edge_id_to_target_map_id AS e
                       ON ( d.edge_id = e.edge_id )
                     INNER JOIN ${NYS_RIS}.raw_target_map_features AS f
                       USING (target_map_id)
               )
               WHERE ( path_len_rnk = 1 ) ;

            COMMIT;
          `,
    );
  }

  createMBTiles() {
    return createMBTiles(this.makeConflationMapSegmentsIterator());
  }

  outputShapefile() {
    return outputShapefile(this.makeConflationMapSegmentsIterator());
  }

  vacuumDatabase() {
    this.dbWriteConnection.exec(`VACUUM ${SCHEMA};`);
  }
}
