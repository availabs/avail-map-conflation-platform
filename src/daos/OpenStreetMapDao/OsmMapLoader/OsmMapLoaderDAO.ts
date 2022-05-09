/* eslint-disable no-restricted-syntax, class-methods-use-this */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';

import db from '../../../services/DbService';

import { OSM } from '../../../constants/databaseSchemaNames';

import validateOsmVersion from '../utils/validateOsmVersion';

import {
  OsmVersion,
  OsmNode,
  OsmWay,
  OsmRelation,
  OsmRouteRelation,
} from '../domain/types';

import getExpectedOsmVersionPbfPath from '../utils/getExpectedOsmVersionPbfPath';

class OpenStreetMapLoaderDao {
  protected connections: {
    // Used for writes
    dbReadConnection: Database | null;
    dbWriteConnection: Database | null;
  };

  protected readonly preparedReadStatements!: {
    getOsmVersionStmt?: Statement;
  };

  protected readonly preparedWriteStatements!: {
    insertOsmNodeStmt?: Statement;
    insertOsmWayStmt?: Statement;
    insertOsmRouteRelationStmt?: Statement;
    loadOsmWayNodeIdsTableStmt?: Statement;
    loadOsmRouteWaysTableStmt?: Statement;
  };

  constructor() {
    this.connections = { dbReadConnection: null, dbWriteConnection: null };

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};
  }

  get dbReadConnection(): Database {
    if (!this.connections.dbReadConnection) {
      this.connections.dbReadConnection = db.openConnectionToDb(
        OSM,
        null,
        'osm',
      );
    }

    return this.connections.dbReadConnection;
  }

  get dbWriteConnection(): Database {
    if (!this.connections.dbWriteConnection) {
      this.connections.dbWriteConnection = db.openConnectionToDb(
        OSM,
        null,
        'osm',
      );

      // @ts-ignore
      this.connections.dbWriteConnection.unsafeMode(true);
      this.connections.dbWriteConnection.pragma(`osm.journal_mode = WAL`);
    }

    return this.connections.dbWriteConnection;
  }

  initializeDatabase() {
    const sql = readFileSync(join(__dirname, './sql/create_osm_tables.sql'), {
      encoding: 'utf8',
    });

    this.dbWriteConnection.exec(sql);
  }

  protected get getOsmVersionStmt(): Statement {
    this.preparedReadStatements.getOsmVersionStmt =
      this.preparedReadStatements.getOsmVersionStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              osm_version
            FROM osm.osm_version ;
        `,
      );

    return this.preparedReadStatements.getOsmVersionStmt;
  }

  get osmVersion(): OsmVersion {
    const osmVersion = this.getOsmVersionStmt.pluck().get();

    if (!validateOsmVersion(osmVersion)) {
      throw new Error('WARNING: Invalid OSM Version ID.');
    }

    return osmVersion;
  }

  setOsmVersion(osmVersion: OsmVersion) {
    if (!validateOsmVersion(osmVersion)) {
      throw new Error('WARNING: Invalid OSM Version ID.');
    }

    this.dbWriteConnection.exec(
      `
        BEGIN;

        DELETE FROM osm.osm_version;

        INSERT INTO osm.osm_version
          VALUES ('${osmVersion}') ;

        COMMIT;
      `,
    );
  }

  get osmPbfFilePath() {
    return getExpectedOsmVersionPbfPath(this.osmVersion);
  }

  get insertOsmNodeStmt(): Statement {
    this.preparedWriteStatements.insertOsmNodeStmt =
      this.preparedWriteStatements.insertOsmNodeStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT OR IGNORE INTO osm.osm_nodes (
            osm_node_id,
            coord,
            tags
          ) VALUES (?, ?, ?) ;
        `,
      );

    return this.preparedWriteStatements.insertOsmNodeStmt;
  }

  insertOsmNode(osmNode: OsmNode) {
    const { id, coord, tags } = osmNode;

    this.insertOsmNodeStmt.run([
      id,
      JSON.stringify(coord),
      tags ? JSON.stringify(tags) : null,
    ]);
  }

  async bulkLoadOsmNodesAsync(osmNodesIterator: AsyncGenerator<OsmNode>) {
    for await (const osmNode of osmNodesIterator) {
      this.insertOsmNode(osmNode);
    }
  }

  get insertOsmWayStmt(): Statement {
    this.preparedWriteStatements.insertOsmWayStmt =
      this.preparedWriteStatements.insertOsmWayStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT OR IGNORE INTO osm.osm_ways (
            osm_way_id,
            osm_node_ids,
            tags
          ) VALUES (?, ?, ?) ;
        `,
      );

    return this.preparedWriteStatements.insertOsmWayStmt;
  }

  insertOsmWay(osmWay: OsmWay) {
    const { id, nodeIds, tags } = osmWay;

    this.insertOsmWayStmt.run([
      id,
      _.isEmpty(nodeIds) ? null : JSON.stringify(nodeIds),
      tags && JSON.stringify(tags),
    ]);
  }

  get loadOsmWayNodeIdsTableStmt() {
    this.preparedWriteStatements.loadOsmWayNodeIdsTableStmt =
      this.preparedWriteStatements.loadOsmWayNodeIdsTableStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT INTO osm.osm_way_node_ids (
            osm_way_id,
            osm_node_idx,
            osm_node_id
          )
            SELECT
                a.osm_way_id,
                b.key AS osm_node_idx,
                b.value AS osm_node_id
              FROM osm.osm_ways AS a,
                json_each(osm_node_ids) AS b
              ORDER BY a.osm_way_id, b.key
        `,
      );

    return this.preparedWriteStatements.loadOsmWayNodeIdsTableStmt;
  }

  loadOsmWayNodeIdsTable() {
    console.log('loadOsmWayNodeIdsTable');
    this.loadOsmWayNodeIdsTableStmt.run();
  }

  async bulkLoadOsmWaysAsync(osmWaysIterator: AsyncGenerator<OsmWay>) {
    for await (const osmWay of osmWaysIterator) {
      const highway = osmWay?.tags?.highway;

      const isRoadWay =
        /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|private|rest_area|road)/.test(
          highway,
        );

      if (isRoadWay) {
        // console.log('osm_way_id:', osmWay.id);
        this.insertOsmWay(osmWay);
      }
    }

    this.loadOsmWayNodeIdsTable();
  }

  get insertOsmRouteRelationStmt(): Statement {
    this.preparedWriteStatements.insertOsmRouteRelationStmt =
      this.preparedWriteStatements.insertOsmRouteRelationStmt ||
      this.dbWriteConnection.prepare(
        `
          INSERT OR IGNORE INTO osm.osm_route_relations (
            osm_route_id,
            tags,
            members
          ) VALUES (?, json(?), json(?)) ;
        `,
      );

    return this.preparedWriteStatements.insertOsmRouteRelationStmt;
  }

  insertOsmRouteRelation({ id, tags, members }: OsmRouteRelation) {
    const isVehicleRoute = tags?.route === 'road' || tags?.route === 'bus';

    if (!isVehicleRoute) {
      return;
    }

    this.insertOsmRouteRelationStmt.run([
      id,
      JSON.stringify(tags),
      JSON.stringify(members),
    ]);
  }

  async bulkLoadOsmRelationsAsync(
    osmRelationsIterator: AsyncGenerator<OsmRelation>,
  ) {
    for await (const osmRelation of osmRelationsIterator) {
      if (osmRelation?.tags?.type === 'route') {
        this.insertOsmRouteRelation(<OsmRouteRelation>osmRelation);
      }
    }
  }

  deleteNonRoadWayNodes() {
    this.dbWriteConnection.exec(
      `
        DELETE
          FROM osm.osm_nodes AS a
            WHERE (
              a.osm_node_id NOT IN (
                SELECT DISTINCT
                    osm_node_id
                  FROM osm.osm_way_node_ids
              )
            )
        ;
      `,
    );
  }

  createOsmRoadWaysMetadataTable() {
    // Assumes existence of OSM Routes metadata tables
    this.dbWriteConnection.function('json_array_lex_sort', (arr) =>
      JSON.stringify(JSON.parse(arr)?.sort()),
    );

    const sql = readFileSync(
      join(__dirname, './sql/create_osm_roadways_metadata.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(sql);
  }

  createOsmRoutesMetadataTable() {
    console.log('createOsmRoadWaysMetadataTable');
    // json_array_prepend
    this.dbWriteConnection.function('json_array_prepend', (arr, elem) =>
      JSON.stringify([elem, ...JSON.parse(arr)]),
    );

    // json_array_includes
    this.dbWriteConnection.function(
      'json_array_includes',
      (arr, elem) => +_.includes(JSON.parse(arr), elem),
    );

    this.dbWriteConnection.function('json_array_num_sort', (arr) =>
      JSON.stringify(JSON.parse(arr)?.sort((a: number, b: number) => a - b)),
    );

    const sql = readFileSync(
      join(__dirname, './sql/create_osm_roadway_routes_metadata.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(sql);
  }

  finalizeDatabase() {
    this.createOsmRoutesMetadataTable();
    // createOsmRoadWaysMetadataTable depends on createOsmRoutesMetadataTable
    this.createOsmRoadWaysMetadataTable();
    this.deleteNonRoadWayNodes();
  }
}

export default new OpenStreetMapLoaderDao();
