import { existsSync, chmodSync } from 'fs';
import { join, isAbsolute } from 'path';

import { sync as mkdirpSync } from 'mkdirp';

import Database, {
  Database as SqliteDatabase,
  Options as SqliteDatabaseConnectionOptions,
} from 'better-sqlite3';

import tmp from 'tmp';

import { SOURCE_MAP } from '../../constants/databaseSchemaNames';

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

const attachedDatabases = new Set();

const getDatabaseFilePath = (databaseSchemaName: string) =>
  join(sqliteDir, databaseSchemaName);

const databaseFileExists = (
  databaseSchemaName: DatabaseSchemaName,
  databaseDirectory?: DatabaseDirectory | null,
) => existsSync(join(databaseDirectory || sqliteDir, databaseSchemaName));

const attachDatabase = (databaseSchemaName: string) => {
  if (attachedDatabases.has(databaseSchemaName)) {
    return;
  }

  const databaseFilePath = getDatabaseFilePath(databaseSchemaName);

  db.exec(`ATTACH DATABASE '${databaseFilePath}' AS ${databaseSchemaName};`);

  attachedDatabases.add(databaseSchemaName);
};

// The SOURCE_MAP database is automatically ATTACHED.
attachDatabase(SOURCE_MAP);

const detachDatabase = (databaseSchemaName: string) => {
  if (!attachedDatabases.has(databaseSchemaName)) {
    return;
  }

  db.exec(`DETACH DATABASE ${databaseSchemaName};`);

  attachedDatabases.delete(databaseSchemaName);
};

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
  config?: SqliteDatabaseConnectionOptions,
): SqliteDatabase => {
  // const xdb = new Database(IN_MEMORY, { verbose: console.log });
  const xdb = new Database(IN_MEMORY, config);
  xdb.pragma('foreign_keys=ON');

  attachDatabaseToConnection(xdb, databaseSchemaName, databaseDirectory);

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

// Prepared statements are memoized
const preparedStmts = {};

// Idempotent
const prepare = (sql: string) => {
  if (preparedStmts[sql]) {
    return preparedStmts[sql];
  }

  const stmt = db.prepare(sql);

  // https://stackoverflow.com/a/28841863/3970755
  preparedStmts[sql] = stmt;
  return stmt;
};

const makeDatabaseWritable = (databaseSchemaName: string) => {
  detachDatabase(databaseSchemaName);

  const databaseFilePath = getDatabaseFilePathForSchemaName(databaseSchemaName);

  chmodSync(databaseFilePath, 0o777);

  attachDatabase(databaseSchemaName);
};

const makeDatabaseReadOnly = (databaseSchemaName: string) => {
  detachDatabase(databaseSchemaName);

  const databaseFilePath = getDatabaseFilePathForSchemaName(databaseSchemaName);

  chmodSync(databaseFilePath, 0o444);

  attachDatabase(databaseSchemaName);
};

const tmpSqliteRemoveCallbacks: Map<
  SqliteDatabase,
  tmp.FileResult['removeCallback']
> = new Map();

// https://www.npmjs.com/package/tmp#graceful-cleanup
tmp.setGracefulCleanup();

const createTemporaryDatabase = (): SqliteDatabase => {
  mkdirpSync(tmpSqliteDir);

  const tmpobj = tmp.fileSync({ tmpdir: tmpSqliteDir });
  // const tmpobj = tmp.fileSync({ tmpdir: tmpSqliteDir, keep: true });

  const tmpDb = new Database(tmpobj.name);

  tmpSqliteRemoveCallbacks.set(tmpDb, tmpobj.removeCallback);

  return tmpDb;
};

const destroyTemporaryDatabase = (tmpDb: SqliteDatabase) => {
  const removeCallback = tmpSqliteRemoveCallbacks.get(tmpDb);

  if (removeCallback) {
    removeCallback();
  }

  tmpSqliteRemoveCallbacks.delete(tmpDb);
};

// Can bind more db methods if they are needed.
//   https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md
export default {
  attachDatabase,
  prepare,
  exec: db.exec.bind(db),
  transaction: db.transaction.bind(db),

  attachDatabaseToConnection,
  detachDatabaseFromConnection,
  openConnectionToDb,
  closeConnectionToDb,

  openLoadingConnectionToDb,
  closeLoadingConnectionToDb,
  databaseFileExists,

  makeDatabaseWritable,
  makeDatabaseReadOnly,

  // @ts-ignore
  unsafeMode: db.unsafeMode.bind(db),
  close: db.close.bind(db),

  createTemporaryDatabase,
  destroyTemporaryDatabase,
};
