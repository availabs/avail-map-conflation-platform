/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';

import db from '../../services/DbService';

import { OSM } from '../../constants/databaseSchemaNames';

import { OsmNode, OsmWay } from './domain/types';

class OsmDao {
  protected connections: {
    // Used for writes
    dbWriteConnection: Database | null;
  };

  protected readonly preparedReadStatements!: {
    osmNodesStmt?: Statement;
  };

  protected readonly preparedWriteStatements!: {
    insertOsmNodeStmt?: Statement;
    insertOsmWayStmt?: Statement;
  };

  constructor() {
    this.connections = { dbWriteConnection: null };

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};
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

  finalizeDatabase() {
    this.dbWriteConnection.pragma(`osm.journal_mode = DELETE`);
  }
}

export default new OsmDao();
