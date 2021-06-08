/* eslint-disable no-restricted-syntax */

/*
    FIXME: The CASCADING DROP TABLE to dependent tables need work.

    FIXME:
      This module MUST work if ONLY the final conflation_map SQLite database is present.
      It MUST NOT depend on any input or intermediate pipeline stage SQLite databases.
      It currently depends on the existence of the source_map SQLite database.
*/

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Database as SQLiteDatbase, Statement } from 'better-sqlite3';

import DbService, {
  DatabaseSchemaName,
  DatabaseDirectory,
} from '../../services/DbService';

import TargetMapConflationBlackboardDao from '../../services/Conflation/TargetMapConflationBlackboardDao';

import getChosenShstReferenceSegmentsForOsmWay from './utils/getChosenShstReferenceSegmentsForOsmWay';
import partitionShstReference from './utils/partitionShstReference';
import createMBTiles from './utils/createMBTiles';
import createMBTilesForQA from './utils/createMBTilesForQA';
import outputShapefile from './utils/outputShapefile';

import {
  CONFLATION_MAP as SCHEMA,
  OSM,
  SOURCE_MAP,
  NYS_RIS,
  NPMRDS,
} from '../../constants/databaseSchemaNames';

import { OsmNodeId, OsmWayId } from '../OpenStreetMapDao/domain/types';

import {
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

function getSql(fName: string) {
  return readFileSync(join(__dirname, './sql/', fName), {
    encoding: 'utf8',
  });
}

function createDbReadConnection(): SQLiteDatbase {
  const dbReadConnection = DbService.openConnectionToDb(
    SCHEMA,
    null,
    'conflation_map',
  );

  DbService.attachDatabaseToConnection(dbReadConnection, OSM, null, 'osm');

  DbService.attachDatabaseToConnection(
    dbReadConnection,
    SOURCE_MAP,
    null,
    'source_map',
  );

  DbService.attachDatabaseToConnection(
    dbReadConnection,
    NYS_RIS,
    null,
    'nys_ris',
  );

  return dbReadConnection;
}

function createDbWriteConnection(): SQLiteDatbase {
  const dbWriteConnection = DbService.openConnectionToDb(
    SCHEMA,
    null,
    'conflation_map',
  );

  DbService.attachDatabaseToConnection(dbWriteConnection, OSM, null, 'osm');
  DbService.attachDatabaseToConnection(
    dbWriteConnection,
    SOURCE_MAP,
    null,
    'source_map',
  );

  DbService.attachDatabaseToConnection(
    dbWriteConnection,
    NYS_RIS,
    null,
    'nys_ris',
  );
  DbService.attachDatabaseToConnection(
    dbWriteConnection,
    NYS_RIS_BB,
    null,
    'nys_ris_bb',
  );
  DbService.attachDatabaseToConnection(
    dbWriteConnection,
    NPMRDS,
    null,
    'npmrds',
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
    conflationMapDatabaseTableExistsStmt?: Statement;
    queryConflationMapMetadataStmt?: Statement;
    allOsmWaysWithShstReferencesStmt?: Statement;
    osmWayChosenMatchesAreLoadedStmt?: Statement;
    risTrafficCountsStationYearDirectionsTableExistsStmt?: Statement;
    risTrafficCountsStationYearDirectionsTableIsLoadedStmt?: Statement;
    targetMapAssignedMatchesAreLoadedStmt?: Statement;
    conflationMapSegmentsAreLoadedStmt?: Statement;
    nysRisConflationMappingsStmt?: Statement;
    nysRisConflationMetricsStmt?: Statement;
    npmrdsConflationMappingsStmt?: Statement;
    npmrdsConflationMetricsStmt?: Statement;
    conflationMapSegmentsStmt?: Statement;
    shstReferenceTargetMapsAssignmentsStmt?: Statement;
  };

  protected readonly preparedWriteStatements: {
    updateConflationMapMetadataStmt?: Statement;
    insertTrafficCountStationYearDirectionStmt?: Statement;
    insertChosenShstReferenceSegmentForOsmWayStmt?: Statement;
    loadTempAllOsmWaysWithShstReferencesTableStmt?: Statement;
    loadOsmWayAssignedMatchesTableStmt?: Statement;
    insertTargetMapAssignedMatchStmt?: Statement;
    insertConflationMapSegmentStmt?: Statement;
  };

  constructor() {
    this.dbReadConnection = createDbReadConnection();
    this.dbWriteConnection = createDbWriteConnection();

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};
  }

  protected get conflationMapDatabaseTableExistsStmt(): Statement {
    this.preparedReadStatements.conflationMapDatabaseTableExistsStmt =
      this.preparedReadStatements.conflationMapDatabaseTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM conflation_map.sqlite_master
              WHERE(
                (type = 'table')
                AND
                (name = ?)
              )
          ) ;
        `,
      );

    return this.preparedReadStatements.conflationMapDatabaseTableExistsStmt;
  }

  protected conflationMapDatabaseTableExists(tableName: string) {
    return !!this.conflationMapDatabaseTableExistsStmt.pluck().get([tableName]);
  }

  protected get conflationMapMetadataTableExists() {
    return this.conflationMapDatabaseTableExists('conflation_map_metadata');
  }

  private get queryConflationMapMetadataStmt(): Statement {
    if (!this.preparedReadStatements.queryConflationMapMetadataStmt) {
      this.preparedReadStatements.queryConflationMapMetadataStmt = this.dbReadConnection.prepare(
        `
          SELECT
              metadata
            FROM conflation_map.conflation_map_metadata ;
        `,
      );
    }

    // @ts-ignore
    return this.preparedReadStatements.queryConflationMapMetadataStmt;
  }

  get conflationMetadata(): Record<string, any> {
    return JSON.parse(this.queryConflationMapMetadataStmt.raw().get()[0]);
  }

  protected get updateConflationMapMetadataStmt(): Statement {
    if (!this.preparedWriteStatements.updateConflationMapMetadataStmt) {
      this.preparedWriteStatements.updateConflationMapMetadataStmt = this.dbWriteConnection.prepare(
        `
          UPDATE conflation_map.conflation_map_metadata
            SET metadata = json_set(metadata, '$.' || ?, json(?))
        `,
      );
    }

    // @ts-ignore
    return this.preparedWriteStatements.updateConflationMapMetadataStmt;
  }

  getMetadataProperty(key: string): any {
    return this.conflationMetadata[key] ?? null;
  }

  setMetadataProperty(key: string, value: any = null) {
    this.updateConflationMapMetadataStmt.run([key, JSON.stringify(value)]);
  }

  get osmVersion() {
    return this.getMetadataProperty('osmVersion');
  }

  get nysRisMapVersion() {
    return this.getMetadataProperty('nysRisMapVersion');
  }

  get nysRisMapExtractArea() {
    return this.getMetadataProperty('nysRisMapExtractArea');
  }

  get npmrdsMapVersion() {
    return this.getMetadataProperty('npmrdsMapVersion');
  }

  get npmrdsMapYear() {
    return this.getMetadataProperty('npmrdsMapVersion');
  }

  get npmrdsMapExtractArea() {
    return this.getMetadataProperty('npmrdsMapExtractArea');
  }

  get nysTrafficCountStationsVersion() {
    return this.getMetadataProperty('nysTrafficCountStationsVersion');
  }

  protected initializeConflationMapMetadata() {
    this.dbWriteConnection.exec(`
      BEGIN;

      DROP TABLE IF EXISTS conflation_map.conflation_map_metadata ;

      CREATE TABLE conflation_map.conflation_map_metadata
        AS
          SELECT
              json_object(
                'osmVersion',                       o.osm_version,

                'nysRisMapVersion',                 json_extract(r.metadata, '$.mapVersion'),
                'nysRisMapExtractArea',             json_extract(r.metadata, '$.mapExtractArea'),
                'nysTrafficCountStationsVersion',   json_extract(r.metadata, '$.nysTrafficCountStationsVersion'),

                'npmrdsMapVersion',                 json_extract(n.metadata, '$.mapVersion'),
                'npmrdsMapExtractArea',             json_extract(n.metadata, '$.mapExtractArea'),
                'npmrdsTmcIdentificationVersion',   json_extract(n.metadata, '$.tmcIdentificationVersion')

              ) AS metadata
            FROM osm.osm_version AS o
              INNER JOIN nys_ris.target_map_metadata AS r ON (true)
              INNER JOIN npmrds.target_map_metadata AS n ON (true) ;

       COMMIT;
    `);
  }

  initialize() {
    try {
      this.loadOsmWayChosenMatchesTable();

      this.loadTargetMapsAssignedMatches();

      this.loadConflationMapSegments();

      this.initializeConflationMapMetadata();

      this.loadRisTrafficCountsStationYearDirectionssTable();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  close() {
    this.dbReadConnection.close();
    this.dbWriteConnection.close();
  }

  beginWriteTransaction() {
    this.dbWriteConnection.pragma(`conflation_map.journal_mode = WAL`);
    this.dbWriteConnection.exec('BEGIN');
  }

  commitWriteTransaction() {
    this.dbWriteConnection.exec('COMMIT');
  }

  rollbackWriteTransaction() {
    this.dbWriteConnection.exec('ROLLBACK');
  }

  protected createTrafficCountStationYearDirectionsTables() {
    const sql = getSql(
      'create_traffic_count_station_year_directions_tables.sql',
    );

    this.dbWriteConnection.exec(sql);
    this.createTargetMapsAssignedMatchesTable();
  }

  protected createOsmChosenMatchesTable() {
    const sql = getSql('create_osm_way_chosen_matches_table.sql');

    this.dbWriteConnection.exec(sql);
    this.createTargetMapsAssignedMatchesTable();
  }

  protected createTargetMapsAssignedMatchesTable() {
    const sql = getSql('create_target_map_assigned_matches_table.sql');

    this.dbWriteConnection.exec(sql);

    this.createConflationMapSegmentsTable();
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

  protected get osmWayChosenMatchesTableExists() {
    return this.conflationMapDatabaseTableExists('osm_way_chosen_matches');
  }

  protected get osmWayChosenMatchesAreLoadedStmt(): Statement {
    this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt =
      this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM conflation_map.osm_way_chosen_matches
          );
        `,
      );

    return this.preparedReadStatements.osmWayChosenMatchesAreLoadedStmt;
  }

  get osmWayChosenMatchesAreLoaded(): boolean {
    return (
      this.osmWayChosenMatchesTableExists &&
      this.osmWayChosenMatchesAreLoadedStmt.pluck().get() === 1
    );
  }

  private createTempAllOsmWaysWithShstReferencesTable() {
    this.dbWriteConnection.exec(`
      DROP TABLE IF EXISTS conflation_map.tmp_all_osm_ways_with_shst_references ;

      CREATE TABLE conflation_map.tmp_all_osm_ways_with_shst_references (
        osm_way_id    INTEGER PRIMARY KEY,
        osm_node_ids  TEXT NOT NULL, -- JSON
        shst_refs     TEXT NOT NULL
      ) WITHOUT ROWID;
    `);
  }

  protected createConflationMapSegmentsTable() {
    const sql = getSql('create_conflation_map_segments_table.sql');

    this.dbWriteConnection.exec(sql);
  }

  protected get loadTempAllOsmWaysWithShstReferencesTableStmt() {
    this.preparedWriteStatements.loadTempAllOsmWaysWithShstReferencesTableStmt =
      this.preparedWriteStatements
        .loadTempAllOsmWaysWithShstReferencesTableStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO conflation_map.tmp_all_osm_ways_with_shst_references
            SELECT
                a.osm_way_id,
                a.osm_node_ids,
                json_group_array(
                  DISTINCT json(b.feature)
                ) AS shst_refs
              FROM osm.osm_ways AS a
                INNER JOIN(
                  SELECT
                      json_extract(t.value, '$.way_id') AS osm_way_id,
                      feature
                    FROM source_map.shst_reference_features,
                      json_each(
                        json_extract(feature, '$.properties.osmMetadataWaySections')
                      ) AS t
                    WHERE(
                      json_extract(feature, '$.properties.minOsmRoadClass') < ${SharedStreetsRoadClass.Other}
                    )
                  ) AS b USING(osm_way_id)
              GROUP BY osm_way_id ;
        `,
      );

    return this.preparedWriteStatements
      .loadTempAllOsmWaysWithShstReferencesTableStmt;
  }

  private loadTempAllOsmWaysWithShstReferencesTable() {
    console.log('loadTempAllOsmWaysWithShstReferencesTable');

    this.beginWriteTransaction();

    console.time('loadTempAllOsmWaysWithShstReferencesTable');

    this.createTempAllOsmWaysWithShstReferencesTable();

    this.loadTempAllOsmWaysWithShstReferencesTableStmt.run();

    this.commitWriteTransaction();

    console.timeEnd('loadTempAllOsmWaysWithShstReferencesTable');
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

    return this.preparedReadStatements.allOsmWaysWithShstReferencesStmt;
  }

  *makeOsmWaysWithShstReferencesIterator(): Generator<{
    osmWayId: OsmWayId;
    osmNodeIds: OsmNodeId[];
    shstReferences: SharedStreetsReferenceFeature[];
  }> {
    console.log('makeOsmWaysWithShstReferencesIterator');

    const iter = this.allOsmWaysWithShstReferencesStmt.raw().iterate();

    let logIterTime = true;
    for (const [osmWayId, osmNodeIdsStr, shstRefsStr] of iter) {
      if (logIterTime) {
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
          INSERT INTO conflation_map.osm_way_chosen_matches(
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

  loadOsmWayChosenMatchesTable() {
    if (this.osmWayChosenMatchesAreLoaded) {
      return;
    }

    try {
      this.loadTempAllOsmWaysWithShstReferencesTable();

      console.log('loadOsmWayChosenMatchesTable');
      console.time('loadOsmWayChosenMatchesTable');

      this.beginWriteTransaction();

      this.createOsmChosenMatchesTable();
      this.createTargetMapsAssignedMatchesTable();
      this.createConflationMapSegmentsTable();

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

      this.commitWriteTransaction();
    } catch (err) {
      console.error(err);
      this.rollbackWriteTransaction();
      throw err;
    } finally {
      console.timeEnd('loadOsmWayChosenMatchesTable');
    }
  }

  protected get targetMapAssignedMatchesTableExists() {
    return this.conflationMapDatabaseTableExists(
      'target_maps_assigned_matches',
    );
  }

  protected get targetMapAssignedMatchesAreLoadedStmt(): Statement {
    this.preparedReadStatements.targetMapAssignedMatchesAreLoadedStmt =
      this.preparedReadStatements.targetMapAssignedMatchesAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT
                    1
                  FROM conflation_map.target_maps_assigned_matches
          );
        `,
      );

    return this.preparedReadStatements.targetMapAssignedMatchesAreLoadedStmt;
  }

  get targetMapAssignedMatchesAreLoaded(): boolean {
    return (
      this.targetMapAssignedMatchesTableExists &&
      this.targetMapAssignedMatchesAreLoadedStmt.pluck().get() === 1
    );
  }

  protected get loadOsmWayAssignedMatchesTableStmt(): Statement {
    this.preparedWriteStatements.loadOsmWayAssignedMatchesTableStmt =
      this.preparedWriteStatements.loadOsmWayAssignedMatchesTableStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO conflation_map.target_maps_assigned_matches (
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

              FROM conflation_map.osm_way_chosen_matches ;
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
          INSERT INTO conflation_map.target_maps_assigned_matches (
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
    if (this.targetMapAssignedMatchesAreLoaded) {
      return;
    }

    console.log('loadTargetMapsAssignedMatches');
    console.time('loadTargetMapsAssignedMatches');

    try {
      this.beginWriteTransaction();

      this.nysRisBBDao = new TargetMapConflationBlackboardDao(NYS_RIS);
      this.npmrdsBBDao = new TargetMapConflationBlackboardDao(NPMRDS);

      this.verifyTargetMapsConflationComplete();

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
      console.error(err);
      this.rollbackWriteTransaction();
      throw err;
    } finally {
      console.timeEnd('loadTargetMapsAssignedMatches');
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
            FROM source_map.shst_reference_features
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
                  FROM conflation_map.target_maps_assigned_matches
                  WHERE ( (section_end - section_start) > 0.0001 )
                  GROUP BY shst_reference_id, target_map
              ) USING (shst_reference_id)
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

            if (targetMap === TargetMap.OSM) {
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

      if (partitions.length === 0) {
        console.error('partitions.length === 0');
      }

      for (let i = 0; i < partitions.length; ++i) {
        yield partitions[i];
      }
    }
  }

  protected get conflationMapSegmentsTableExists() {
    return this.conflationMapDatabaseTableExists('conflation_map_segments');
  }

  protected get conflationMapSegmentsAreLoadedStmt(): Statement {
    this.preparedReadStatements.conflationMapSegmentsAreLoadedStmt =
      this.preparedReadStatements.conflationMapSegmentsAreLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM conflation_map.conflation_map_segments
          );
        `,
      );

    return this.preparedReadStatements.conflationMapSegmentsAreLoadedStmt;
  }

  get conflationMapSegmentsAreLoaded(): boolean {
    return (
      this.conflationMapSegmentsTableExists &&
      this.conflationMapSegmentsAreLoadedStmt.pluck().get() === 1
    );
  }

  protected get insertConflationMapSegmentStmt() {
    this.preparedWriteStatements.insertConflationMapSegmentStmt =
      this.preparedWriteStatements.insertConflationMapSegmentStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO conflation_map.conflation_map_segments(
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
    if (this.conflationMapSegmentsAreLoaded) {
      return;
    }

    try {
      console.time('loadConflationMapSegments');

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

      this.loadQALengthsTables();
    } catch (err) {
      this.rollbackWriteTransaction();
      throw err;
    } finally {
      console.timeEnd('loadConflationMapSegments');
    }
  }

  protected get nysRisConflationMappingsStmt(): Statement {
    this.preparedReadStatements.nysRisConflationMappingsStmt =
      this.preparedReadStatements.nysRisConflationMappingsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              a.id,
              json_extract(a.nys_ris, '$.targetMapId') AS targetMapId,
              b.is_forward AS isForward
            FROM conflation_map.conflation_map_segments AS a
              INNER JOIN conflation_map.target_maps_assigned_matches AS b
                ON (
                  ( CAST(json_extract(a.nys_ris, '$.targetMapId') AS INTEGER) = b.target_map_id )
                  AND
                  ( a.shst = b.shst_reference_id )
                  AND
                  ( b.target_map = 'nys_ris' )
                )
            WHERE ( a.nys_ris IS NOT NULL )
        `,
      );

    return this.preparedReadStatements.nysRisConflationMappingsStmt;
  }

  get nysRisConflationMappings() {
    return this.nysRisConflationMappingsStmt.all();
  }

  protected get nysRisConflationMetricsStmt(): Statement {
    this.preparedReadStatements.nysRisConflationMetricsStmt =
      this.preparedReadStatements.nysRisConflationMetricsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              nys_ris AS targetMapId,
              target_map_edge_length,
              is_unidirectional,
              forward_conflation_segments_length_sum,
              backward_conflation_segments_length_sum
            FROM conflation_map.qa_nys_ris_lengths ;
        `,
      );

    return this.preparedReadStatements.nysRisConflationMetricsStmt;
  }

  get nysRisConflationMetrics() {
    return this.nysRisConflationMetricsStmt
      .all()
      .reduce(
        (
          acc,
          {
            targetMapId,
            target_map_edge_length,
            is_unidirectional,
            forward_conflation_segments_length_sum,
            backward_conflation_segments_length_sum,
          },
        ) => {
          acc[targetMapId] = {
            targetMapId,
            targetMapEdgeLength: _.round(target_map_edge_length, 6),
            isUnidirectional: !!is_unidirectional,
            forwardConflationSegmentsLengthSum:
              forward_conflation_segments_length_sum &&
              _.round(forward_conflation_segments_length_sum, 6),
            backwardConflationSegmentsLengthSum:
              backward_conflation_segments_length_sum &&
              _.round(backward_conflation_segments_length_sum, 6),
          };

          return acc;
        },
        {},
      );
  }

  protected get npmrdsConflationMappingsStmt(): Statement {
    this.preparedReadStatements.npmrdsConflationMappingsStmt =
      this.preparedReadStatements.npmrdsConflationMappingsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              id,
              json_extract(npmrds, '$.targetMapId') AS targetMapId,
              1 AS isForward
            FROM conflation_map.conflation_map_segments
            WHERE ( npmrds IS NOT NULL )
        `,
      );

    return this.preparedReadStatements.npmrdsConflationMappingsStmt;
  }

  get npmrdsConflationMappings() {
    return this.npmrdsConflationMappingsStmt.all();
  }

  protected get npmrdsConflationMetricsStmt(): Statement {
    this.preparedReadStatements.npmrdsConflationMetricsStmt =
      this.preparedReadStatements.npmrdsConflationMetricsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              tmc AS targetMapId,
              target_map_edge_length,
              forward_conflation_segments_length_sum
            FROM conflation_map.qa_npmrds_lengths ;
        `,
      );

    return this.preparedReadStatements.npmrdsConflationMetricsStmt;
  }

  get npmrdsConflationMetrics() {
    return this.npmrdsConflationMetricsStmt
      .all()
      .reduce(
        (
          acc,
          {
            targetMapId,
            target_map_edge_length,
            forward_conflation_segments_length_sum,
          },
        ) => {
          acc[targetMapId] = {
            targetMapId,
            targetMapEdgeLength: _.round(target_map_edge_length, 6),
            isUnidirectional: true,
            forwardConflationSegmentsLengthSum:
              forward_conflation_segments_length_sum &&
              _.round(forward_conflation_segments_length_sum, 6),
            backwardConflationSegmentsLengthSum: null,
          };

          return acc;
        },
        {},
      );
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
                  'osmHighway',                   json_extract(d.tags, '$.highway'),
                  'nys_ris',                      json(b.nys_ris),
                  'npmrds',                       json(npmrds),
                  'tdsRcStation',                 tds_rc_station,
                  'tdsFederalDirection',          tds_federal_direction
                )
              ) AS segments,
              feature AS shst_reference

            FROM source_map.shst_reference_features AS a
              INNER JOIN conflation_map.conflation_map_segments AS b
                ON ( a.shst_reference_id = b.shst )
              LEFT OUTER JOIN conflation_map.ris_assigned_match_federal_directions AS c
                ON (
                  ( json_extract(b.nys_ris, '$.targetMapId') = c.nys_ris )
                  AND
                  ( json_extract(b.nys_ris, '$.isForward') = c.is_forward )
                )
              LEFT OUTER JOIN osm.osm_ways AS d
                ON (
                  ( json_extract(b.osm, '$.targetMapId') = d.osm_way_id )
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

  protected get risTrafficCountsStationYearDirectionsTableExistsStmt(): Statement {
    this.preparedReadStatements.risTrafficCountsStationYearDirectionsTableExistsStmt =
      this.preparedReadStatements
        .risTrafficCountsStationYearDirectionsTableExistsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM nys_ris.sqlite_master
              WHERE(
                (type = 'table')
                AND
                (name = 'nys_traffic_counts_station_year_directions')
              )
          ) ;
        `,
      );

    return this.preparedReadStatements
      .risTrafficCountsStationYearDirectionsTableExistsStmt;
  }

  protected get risTrafficCountsStationYearDirectionsTableExists() {
    return !!this.risTrafficCountsStationYearDirectionsTableExistsStmt
      .pluck()
      .get();
  }

  protected get risTrafficCountsStationYearDirectionsTableIsLoadedStmt(): Statement {
    this.preparedReadStatements.risTrafficCountsStationYearDirectionsTableIsLoadedStmt =
      this.preparedReadStatements
        .risTrafficCountsStationYearDirectionsTableIsLoadedStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT EXISTS(
            SELECT 1
              FROM nys_ris.nys_traffic_counts_station_year_directions
          );
        `,
      );

    return this.preparedReadStatements
      .risTrafficCountsStationYearDirectionsTableIsLoadedStmt;
  }

  get risTrafficCountsStationYearDirectionsTableIsLoaded(): boolean {
    return (
      this.risTrafficCountsStationYearDirectionsTableExists &&
      this.risTrafficCountsStationYearDirectionsTableIsLoadedStmt
        .pluck()
        .get() === 1
    );
  }

  loadRisTrafficCountsStationYearDirectionssTable() {
    if (!this.risTrafficCountsStationYearDirectionsTableIsLoaded) {
      throw new Error(
        'The nys_ris.nys_traffic_counts_station_year_directions table is not loaded. Please run load_nys_traffic_count_stations.',
      );
    }

    this.dbWriteConnection.function(
      'getFederalDirection',
      { deterministic: true },
      getFederalDirection,
    );

    this.dbWriteConnection.function(
      'intArraySort',
      { deterministic: true },
      (arr: string) =>
        JSON.stringify(JSON.parse(arr).sort((a: number, b: number) => a - b)),
    );

    const sql = getSql('load_ris_assigned_match_federal_directions.sql');

    this.dbWriteConnection.exec(sql);
  }

  loadQALengthsTables() {
    const sql = getSql('load_qa_lengths_tables.sql');
    this.dbWriteConnection.exec(sql);
  }

  createMBTiles() {
    return createMBTiles(this.makeConflationMapSegmentsIterator());
  }

  createMBTilesForQA() {
    return createMBTilesForQA(this.makeConflationMapSegmentsIterator());
  }

  outputShapefile() {
    const shapefileDir = outputShapefile(
      this.makeConflationMapSegmentsIterator(),
    );

    writeFileSync(
      join(shapefileDir, 'conflation_metadata.json'),
      JSON.stringify(this.conflationMetadata),
    );
  }

  vacuumDatabase() {
    this.dbWriteConnection.exec(`VACUUM conflation_map;`);
  }
}
