import { sync as mkdirpSync } from 'mkdirp';

import Database, { Database as SqliteDatabase } from 'better-sqlite3';

import { join, isAbsolute } from 'path';

import memoizeOne from 'memoize-one';

const IN_MEMORY = ':memory:';

// const db = new Database(IN_MEMORY, { verbose: console.log });
const db = new Database(IN_MEMORY);

const registeredDatabases: string[] = Object.values(
  require('../../constants/databaseSchemaNames'),
);

let OUTPUT_DIR = '';

const verifyConfigured = () => {
  if (OUTPUT_DIR === '') {
    throw new Error('Database output_dir is not configured.');
  }
};

// Needs to run after module is loaded so "main" has a chance to set.
const getSqliteDir = memoizeOne(() => {
  verifyConfigured();

  const sqliteDir = isAbsolute(OUTPUT_DIR)
    ? join(OUTPUT_DIR, 'sqlite')
    : join(process.cwd(), OUTPUT_DIR, 'sqlite');

  mkdirpSync(sqliteDir);

  return sqliteDir;
});

const attachedDatabases = new Set();

const attachDatabase = (databaseSchemaName: string) => {
  verifyConfigured();

  if (attachedDatabases.has(databaseSchemaName)) {
    return;
  }

  const databaseFilePath = join(getSqliteDir(), databaseSchemaName);

  db.exec(`ATTACH DATABASE '${databaseFilePath}' AS ${databaseSchemaName};`);

  attachedDatabases.add(databaseSchemaName);
};

const getDatabaseFilePathForSchemaName = (databaseSchemaName: string) =>
  join(getSqliteDir(), databaseSchemaName);

const openLoadingConnectionToDb = (
  databaseSchemaName: string | null = null,
) => {
  if (databaseSchemaName === null) {
    return new Database(db.name);
  }

  const databaseFilePath = getDatabaseFilePathForSchemaName(databaseSchemaName);

  // const xdb = new Database(IN_MEMORY, { verbose: console.log });
  const xdb = new Database(IN_MEMORY);

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
  verifyConfigured();

  if (preparedStmts[sql]) {
    return preparedStmts[sql];
  }

  const stmt = db.prepare(sql);

  // https://stackoverflow.com/a/28841863/3970755
  preparedStmts[sql] = stmt;
  return stmt;
};

const setOutputDirectory = (outputDir: string) => {
  if (OUTPUT_DIR === '') {
    OUTPUT_DIR = outputDir;

    registeredDatabases.forEach(attachDatabase);
  } else if (OUTPUT_DIR !== outputDir) {
    throw new Error('Output Directory cannot be changed.');
  }
};

// Can bind more db methods if they are needed.
//   https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md
export default {
  setOutputDirectory,
  attachDatabase,
  prepare,
  exec: db.exec.bind(db),
  transaction: db.transaction.bind(db),
  openLoadingConnectionToDb,
  closeLoadingConnectionToDb,

  // @ts-ignore
  unsafeMode: db.unsafeMode.bind(db),
};
