import { existsSync, chmodSync } from 'fs';
import { join, isAbsolute } from 'path';

import { sync as mkdirpSync } from 'mkdirp';

import Database, {
  Database as SqliteDatabase,
  Options as SqliteDatabaseConnectionOptions,
} from 'better-sqlite3';

import tmp from 'tmp';

export type DatabaseSchemaName = string;
export type DatabaseDirectory = string;

const IN_MEMORY = ':memory:';

// const db = new Database(IN_MEMORY, { verbose: console.log });
const db = new Database(IN_MEMORY);
db.pragma('foreign_keys=ON');

const envVarOutputDirOverride =
  process.env.AVAIL_MAP_CONFLATION_OUTPUT_DIR || null;

const envVaribleOutputDirPath =
  envVarOutputDirOverride &&
  (isAbsolute(envVarOutputDirOverride)
    ? envVarOutputDirOverride
    : join(process.cwd(), envVarOutputDirOverride));

const defaultOutputDirPath = join(__dirname, '../../../output/');

const OUTPUT_DIR = envVaribleOutputDirPath || defaultOutputDirPath;

const sqliteDir = isAbsolute(OUTPUT_DIR)
  ? join(OUTPUT_DIR, 'sqlite')
  : join(process.cwd(), OUTPUT_DIR, 'sqlite');

mkdirpSync(sqliteDir);

const tmpSqliteDir = join(__dirname, '../../../output/tmp/');

mkdirpSync(tmpSqliteDir);

const databaseFileExists = (
  databaseSchemaName: DatabaseSchemaName,
  databaseDirectory?: DatabaseDirectory | null,
) => existsSync(join(databaseDirectory || sqliteDir, databaseSchemaName));

const getDatabaseFilePathForSchemaName = (
  databaseSchemaName: string,
  databaseDirectory?: DatabaseDirectory | null,
) => join(databaseDirectory || sqliteDir, databaseSchemaName);

const attachDatabaseToConnection = (
  xdb: SqliteDatabase,
  databaseSchemaName: DatabaseSchemaName,
  databaseDirectory: DatabaseDirectory | null = null,
  alias: string | null = null,
) => {
  const databaseFilePath = getDatabaseFilePathForSchemaName(
    databaseSchemaName,
    databaseDirectory,
  );

  xdb.exec(
    `ATTACH DATABASE '${databaseFilePath}' AS ${alias || databaseSchemaName};`,
  );
};

const detachDatabaseFromConnection = (
  xdb: SqliteDatabase,
  databaseSchemaName: DatabaseSchemaName | string,
) => {
  xdb.exec(`DETACH DATABASE '${databaseSchemaName}';`);
};

/**
 * All databases ATTACHED to a :MEMORY: database AS databaseSchemaName.
 */
const openConnectionToDb = (
  databaseSchemaName: DatabaseSchemaName,
  databaseDirectory: DatabaseDirectory | null = null,
  alias: string | null = null,
  config?: SqliteDatabaseConnectionOptions,
): SqliteDatabase => {
  // const xdb = new Database(IN_MEMORY, { verbose: console.log });
  const xdb = new Database(IN_MEMORY, config);
  xdb.pragma('foreign_keys=ON');

  attachDatabaseToConnection(xdb, databaseSchemaName, databaseDirectory, alias);

  return xdb;
};

const closeConnectionToDb = (xdb: SqliteDatabase) => {
  xdb.close();
};

const openLoadingConnectionToDb = (
  databaseSchemaName: string | null = null,
): SqliteDatabase => {
  if (databaseSchemaName === null) {
    return new Database(db.name);
  }

  const databaseFilePath = getDatabaseFilePathForSchemaName(databaseSchemaName);

  // const xdb = new Database(IN_MEMORY, { verbose: console.log });
  const xdb = new Database(IN_MEMORY);
  xdb.pragma('foreign_keys=ON');

  xdb.exec(`ATTACH DATABASE '${databaseFilePath}' AS ${databaseSchemaName};`);

  return xdb;
};

const closeLoadingConnectionToDb = (xdb: SqliteDatabase) => {
  xdb.close();
};

const tmpSqliteRemoveCallbacks: Map<
  SqliteDatabase,
  tmp.FileResult['removeCallback']
> = new Map();

// https://www.npmjs.com/package/tmp#graceful-cleanup
tmp.setGracefulCleanup();

const getTemporaryDatabaseFile = ({ keep } = { keep: false }) => {
  const tmpobj = tmp.fileSync({ tmpdir: tmpSqliteDir, keep });

  return tmpobj;
};

const createTemporaryDatabase = (
  { keep } = { keep: false },
): SqliteDatabase => {
  const { name, removeCallback } = getTemporaryDatabaseFile({ keep });

  const tmpDb = new Database(name);

  tmpSqliteRemoveCallbacks.set(tmpDb, removeCallback);

  return tmpDb;
};

const destroyTemporaryDatabase = (tmpDb: SqliteDatabase) => {
  const removeCallback = tmpSqliteRemoveCallbacks.get(tmpDb);

  if (removeCallback) {
    removeCallback();
  }

  tmpSqliteRemoveCallbacks.delete(tmpDb);
};

const createConnectionToDatabaseFile = (dbFilePath: string) => {
  return new Database(dbFilePath);
};

const makeDatabaseReadonly = (
  databaseSchemaName: DatabaseSchemaName,
  databaseDirectory: DatabaseDirectory | null = null,
) => {
  const dbFilePath = getDatabaseFilePathForSchemaName(
    databaseSchemaName,
    databaseDirectory,
  );

  chmodSync(dbFilePath, 0o444);
};

const shrinkwrapDatabase = (
  databaseSchemaName: DatabaseSchemaName,
  databaseDirectory: DatabaseDirectory | null = null,
) => {
  try {
    const xdb = openConnectionToDb(databaseSchemaName, databaseDirectory);

    xdb.pragma(`${databaseSchemaName}.journal_mode = DELETE;`);
    xdb.close();

    makeDatabaseReadonly(databaseSchemaName, databaseDirectory);
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// Can bind more db methods if they are needed.
//   https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md
export default {
  tmpSqliteDir,

  attachDatabaseToConnection,
  detachDatabaseFromConnection,
  openConnectionToDb,
  closeConnectionToDb,

  openLoadingConnectionToDb,
  closeLoadingConnectionToDb,
  databaseFileExists,

  getTemporaryDatabaseFile,
  createTemporaryDatabase,
  destroyTemporaryDatabase,

  createConnectionToDatabaseFile,

  makeDatabaseReadonly,
  shrinkwrapDatabase,
};
