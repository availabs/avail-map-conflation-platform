/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import { Database as SQLiteDatbase, Statement } from 'better-sqlite3';

import db, {
  DatabaseSchemaName,
  DatabaseDirectory,
} from '../../services/DbService';

import TargetMapConflationBlackboardDao from '../../services/Conflation/TargetMapConflationBlackboardDao';

import { getGeometriesConcaveHull } from '../../utils/gis/hulls';

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

import { NysRoadInventorySystemFeature } from '../NysRisDAO/raw_map_layer/domain/types';
import { NpmrdsTmcFeature } from '../NpmrdsDAO/raw_map_layer/domain/types';

export type TargetMapConflationBlackboardDaoConfig = {
  databaseDirectory?: DatabaseDirectory | null;
  databaseSchemaName?: DatabaseSchemaName | null;
};

export enum TargetMaps {
  OSM = 'OSM',
  // eslint-disable-next-line @typescript-eslint/no-shadow
  NYS_RIS = 'NYS_RIS',
  // eslint-disable-next-line @typescript-eslint/no-shadow
  NPMRDS = 'NPMRDS',
}

const albanyCounty: turf.Feature<turf.Polygon> = JSON.parse(
  readFileSync(join(__dirname, './albanyCounty.geojson'), { encoding: 'utf8' }),
);

function createDbReadConnection(): SQLiteDatbase {
  const dbReadConnection = db.openConnectionToDb(SCHEMA);

  db.attachDatabaseToConnection(dbReadConnection, SOURCE_MAP);

  return dbReadConnection;
}

function createDbWriteConnection(): SQLiteDatbase {
  const dbWriteConnection = db.openConnectionToDb(SCHEMA);

  return dbWriteConnection;
}

export default class ConflationMapDAO {
  nysRisBBDao: TargetMapConflationBlackboardDao<NysRoadInventorySystemFeature>;

  npmrdsBBDao: TargetMapConflationBlackboardDao<NpmrdsTmcFeature>;

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
  };

  protected readonly preparedWriteStatements: {
    insertChosenShstReferenceSegmentForOsmWayStmt?: Statement;
    loadOsmWayAssignedMatchesTableStmt?: Statement;
    insertTargetMapAssignedMatchStmt?: Statement;
  };

  constructor() {
    this.nysRisBBDao = new TargetMapConflationBlackboardDao(NYS_RIS);
    this.npmrdsBBDao = new TargetMapConflationBlackboardDao(NPMRDS);

    this.verifyTargetMapsConflationComplete();

    this.dbReadConnection = createDbReadConnection();
    this.dbWriteConnection = createDbWriteConnection();

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};

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
        console.log('loadTargetMapsAssignedMatches');
        console.time('loadTargetMapsAssignedMatches');
        this.loadTargetMapsAssignedMatches();
        console.timeEnd('loadTargetMapsAssignedMatches');
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
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
      incompleteTargetMapConflations.push('NYS RIS');
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
            SELECT
                    1
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
            INNER JOIN(
              SELECT DISTINCT
                  json_extract(t.value, '$.way_id') AS osm_way_id,
                  shst_reference_id

                FROM ${SOURCE_MAP}.shst_reference_features,
                  json_each(
                    json_extract(feature, '$.properties.osmMetadataWaySections')
                  ) AS t
                WHERE(
                  json_extract(feature, '$.properties.minOsmRoadClass') < ${SharedStreetsRoadClass.Other}
                )
              ) AS b
                USING(osm_way_id)

            INNER JOIN ${SOURCE_MAP}.shst_reference_features AS c
              USING(shst_reference_id)

            INNER JOIN(
              SELECT
                  shst_reference_id
                FROM ${SOURCE_MAP}.shst_reference_features_geopoly_idx
                WHERE geopoly_overlap(_shape, ?)
            )
              USING(shst_reference_id)

          WHERE(
            json_extract(feature, '$.properties.minOsmRoadClass') < ${SharedStreetsRoadClass.Other}
          )

          GROUP BY osm_way_id

          ORDER BY osm_way_id;
      `,
      );

    return this.preparedReadStatements.allOsmWaysWithShstReferencesStmt;
  }

  *makeOsmWaysWithShstReferencesIterator(): Generator<{
    osmWayId: OsmWayId;
    osmNodeIds: OsmNodeId[];
    shstReferences: SharedStreetsReferenceFeature[];
  }> {
    const boundingPolyHull = getGeometriesConcaveHull([albanyCounty]);
    const [boundingPolyCoords] = turf.getCoords(boundingPolyHull);

    const iter = this.allOsmWaysWithShstReferencesStmt
      .raw()
      .iterate([JSON.stringify(boundingPolyCoords)]);

    for (const [osmWayId, osmNodeIdsStr, shstRefsStr] of iter) {
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

    // @ts-ignore
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

      this.createOsmChosenMatchesTable();

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

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      this.dbWriteConnection.exec('ROLLBACK');
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
                '${TargetMaps.OSM}' AS target_map,
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
          TargetMaps.NYS_RIS,
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
          TargetMaps.NPMRDS,
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

  vacuumDatabase() {
    this.dbWriteConnection.exec(`VACUUM ${SCHEMA};`);
  }
}
