/* eslint-disable no-restricted-syntax, no-underscore-dangle */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database, Statement } from 'better-sqlite3';

import DbService from '../../../../services/DbService';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  SharedStreetsOsmTileSource,
  SharedStreetsBuilderVersion,
} from '../../domain/types';

export default class SharedStreetsLoadingInitializer {
  protected dbWriteConnection: Database;

  protected readonly preparedWriteStatements!: {
    shstTileSourceTableExistsStmt?: Statement;
    setShstTileSourceStmt?: Statement;
  };

  constructor() {
    this.dbWriteConnection = DbService.openConnectionToDb(SCHEMA, null, 'shst');

    this.preparedWriteStatements = {};
  }

  setDatabaseToWalMode() {
    this.dbWriteConnection.pragma(`shst.journal_mode = WAL`);
  }

  protected initializeDatabaseTables() {
    const ddl = readFileSync(
      join(__dirname, './sql/create_shst_tileset_provenance_table.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(ddl);
  }

  setShstTilesetProvenance(
    shstOsmTileSource: SharedStreetsOsmTileSource,
    shstBuilderVersion: SharedStreetsBuilderVersion,
  ) {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      this.initializeDatabaseTables();

      this.dbWriteConnection.exec(`
        INSERT INTO shst.shst_tileset_provenance (
          tile_source,
          shst_builder_version
        ) VALUES ('${shstOsmTileSource}', '${shstBuilderVersion}') ;
    `);

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      console.error(err.message);
      this.dbWriteConnection.exec('ROLLBACK');
      throw err;
    }
  }
}
