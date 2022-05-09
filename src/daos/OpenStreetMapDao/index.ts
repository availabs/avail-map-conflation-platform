/* eslint-disable no-restricted-syntax, class-methods-use-this */

// import { readFileSync } from 'fs';
// import { join } from 'path';

// import _ from 'lodash';

import { Database, Statement } from 'better-sqlite3';

import db from '../../services/DbService';

import { OSM } from '../../constants/databaseSchemaNames';

import validateOsmVersion from './utils/validateOsmVersion';

import {
  OsmVersion,
  // OsmNode,
  // OsmWay,
  // OsmRelation,
  // OsmRouteRelation,
} from './domain/types';

import getExpectedOsmVersionPbfPath from './utils/getExpectedOsmVersionPbfPath';

class OpenStreetMapDAO {
  protected connections: {
    // Used for writes
    dbReadConnection: Database | null;
    dbWriteConnection: Database | null;
  };

  protected readonly preparedReadStatements!: {
    getOsmVersionStmt?: Statement;
  };

  constructor() {
    this.connections = { dbReadConnection: null, dbWriteConnection: null };

    this.preparedReadStatements = {};
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

  get osmPbfFilePath() {
    return getExpectedOsmVersionPbfPath(this.osmVersion);
  }
}

export default new OpenStreetMapDAO();
