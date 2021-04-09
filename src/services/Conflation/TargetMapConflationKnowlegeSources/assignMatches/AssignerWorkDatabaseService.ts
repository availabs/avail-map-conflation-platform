import { unlinkSync } from 'fs';

import Database, { Database as SqliteDatabase } from 'better-sqlite3';
import DbService from '../../../DbService';

import { TargetMapSchema } from '../../../../utils/TargetMapDatabases/TargetMapDAO';
import TargetMapConflationBlackboardDao from '../../TargetMapConflationBlackboardDao';

export type AttachedDatabasesList = {
  name: string;
  file: string;
}[];

export default class AssignerWorkDatabaseService {
  static createTemporaryWorkDatabaseConnection(
    targetMapSchema: TargetMapSchema,
    dbFilePath: string | null = null,
  ) {
    const db =
      dbFilePath === null
        ? DbService.createTemporaryDatabase({ keep: true })
        : DbService.createConnectionToDatabaseFile(dbFilePath);

    const blkbrdDbSchema = TargetMapConflationBlackboardDao.getBlackboardSchemaName(
      targetMapSchema,
    );

    // @ts-ignore
    db.unsafeMode(true);

    db.pragma('main.journal_mode = WAL');

    DbService.attachDatabaseToConnection(db, 'source_map');

    DbService.attachDatabaseToConnection(
      db,
      targetMapSchema,
      null,
      'target_map',
    );

    DbService.attachDatabaseToConnection(
      db,
      blkbrdDbSchema,
      null,
      'target_map_bb',
    );

    return db;
  }

  static listAttachedDatabases(db: SqliteDatabase): AttachedDatabasesList {
    return db.pragma('database_list').filter(({ name }) => name !== 'main');
  }

  static attachDatabaseToConnection(
    db: SqliteDatabase,
    alias: string = 'local',
    dbFilePath: string | null = DbService.getTemporaryDatabaseFile().name,
  ) {
    db.exec(`ATTACH DATABASE '${dbFilePath}' AS ${alias};`);

    return db;
  }

  static buildDatabaseConnection(attachedDatabasesList: AttachedDatabasesList) {
    // @ts-ignore
    const mainFilePath: string = attachedDatabasesList.find(
      ({ name }) => name === 'main',
    )?.file;

    const db = new Database(mainFilePath);

    attachedDatabasesList.forEach(({ name, file }) => {
      if (name !== 'main') {
        AssignerWorkDatabaseService.attachDatabaseToConnection(db, name, file);
      }
    });

    return db;
  }

  static cloneDatabaseConnection(db: SqliteDatabase) {
    const cloneDb = new Database(db.name);

    AssignerWorkDatabaseService.listAttachedDatabases(
      db,
    ).forEach(({ name, file }) =>
      AssignerWorkDatabaseService.attachDatabaseToConnection(
        cloneDb,
        name,
        file,
      ),
    );

    return cloneDb;
  }

  static destroyTemporaryWorkDatabaseConnection(
    db: SqliteDatabase,
    aliasesToDelete: string | string[] | null = null,
  ) {
    const attachedDatabases = AssignerWorkDatabaseService.listAttachedDatabases(
      db,
    );

    db.close();

    if (aliasesToDelete) {
      const toDelete = Array.isArray(aliasesToDelete)
        ? aliasesToDelete
        : [aliasesToDelete];

      attachedDatabases.forEach(({ name, file }) => {
        if (
          toDelete.includes(name) &&
          file.startsWith(DbService.tmpSqliteDir)
        ) {
          unlinkSync(file);
        }
      });
    }
  }
}
