/* eslint-disable no-restricted-syntax, class-methods-use-this */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';

import db from '../../services/DbService';

import { OSM } from '../../constants/databaseSchemaNames';

import validateOsmVersion from './utils/validateOsmVersion';

import { OsmVersion, OsmNode, OsmWay } from './domain/types';

class OpenStreetMapDao {
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

  async bulkLoadOsmWaysAsync(osmWaysIterator: AsyncGenerator<OsmWay>) {
    for await (const osmWay of osmWaysIterator) {
      this.insertOsmWay(osmWay);
    }
  }

  createOsmWayShstRoadclassTable() {
    const sql = readFileSync(
      join(__dirname, './sql/create_osm_highway_shst_roadclass_table.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(sql);
  }

  createCanonicalNodesTable() {
    const cleanNodeIds = (nodesArrStr: string) => {
      const nodesArr: { n: number; i: number }[] = JSON.parse(nodesArrStr);

      const cleaned = nodesArr
        .sort((a, b) => a.i - b.i)
        .filter(({ n }, i, arr) => arr[i - 1]?.n !== n)
        .map(({ n }) => n);

      return JSON.stringify(cleaned);
    };

    this.dbWriteConnection.function(
      'clean_node_ids',
      { deterministic: true },
      cleanNodeIds,
    );

    const sql = readFileSync(
      join(__dirname, './sql/create_canonical_osm_nodes_table.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(sql);
  }

  finalizeDatabase() {
    this.createOsmWayShstRoadclassTable();
    this.createCanonicalNodesTable();
  }
}

export default new OpenStreetMapDao();
