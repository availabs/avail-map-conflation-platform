import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

import Database from 'better-sqlite3';

import {
  getConflationBlkbrdDbPath,
  conflationBlkbrdSnapshotsFsUtils,
  conflationBlkbrdDiffsFsUtils,
} from './utils/conflationBlkbrdDbPaths';

export function snapshotDatabase(
  blkbrdPath: string,
  snapshotPath: string,
  targetMap: string,
  timestamp: string,
) {
  const sql = readFileSync(
    join(__dirname, './sql/createConflationBlackboardSnapshotDatabase.sql'),
    { encoding: 'utf8' },
  );

  const db = new Database(snapshotPath);

  db.exec(`ATTACH DATABASE '${blkbrdPath}' AS tmap_blkbrd;`);

  db.exec(sql);

  db.prepare(
    `
      INSERT INTO conflation_blackboard_snapshot_metadata (
        target_map,
        timestamp
      ) VALUES (?, ?) ;
    `,
  ).run([targetMap, timestamp]);

  db.close();
}

export function diffSnapshots(
  diffPath: string,
  snapshotPathA: string,
  snapshotPathB: string,
  targetMap: string,
  a_timestamp: string,
  b_timestamp: string,
) {
  const sql = readFileSync(
    join(
      __dirname,
      './sql/createConflationBlackboardSnapshotsDiffDatabase.sql',
    ),
    { encoding: 'utf8' },
  );

  const db = new Database(diffPath);

  try {
    db.exec('BEGIN;');

    db.exec(`ATTACH DATABASE '${snapshotPathA}' AS a;`);
    db.exec(`ATTACH DATABASE '${snapshotPathB}' AS b;`);

    db.exec(sql);

    db.prepare(
      `
      INSERT INTO main.conflation_blackboard_snapshot_diff_metadata (
        target_map,
        a_timestamp,
        b_timestamp
      ) VALUES (?, ?, ?) ;
    `,
    ).run([targetMap, a_timestamp, b_timestamp]);

    db.exec('COMMIT;');

    db.exec('VACUUM main;');
  } catch (err) {
    console.error(err);
    db.exec('ROLLBACK;');
  } finally {
    db.close();
  }
}

export function createBlkbrdDatabaseSnapshot(
  targetMap: string,
  timestamp: string,
) {
  const blkbrdPath = getConflationBlkbrdDbPath(targetMap);

  // NOTE: During conflation dev may be done on a single TargetMap
  //       so we must check whether the BlkBrd DB exists.
  if (!existsSync(blkbrdPath)) {
    throw new Error(
      `ERROR: Conflation Blackboard does not exist for ${targetMap}`,
    );
  }

  const snapshotPath = conflationBlkbrdSnapshotsFsUtils.getSnapshotPath(
    targetMap,
    timestamp,
  );

  mkdirSync(dirname(snapshotPath), { recursive: true });

  snapshotDatabase(blkbrdPath, snapshotPath, targetMap, timestamp);
}

export function createBlkbrdDatabaseSnapshotsDiff(
  targetMap: string,
  timestamps: [string, string],
) {
  const [a_timestamp, b_timestamp] = timestamps;

  const snapshotPathA = conflationBlkbrdSnapshotsFsUtils.getSnapshotPath(
    targetMap,
    a_timestamp,
  );
  const snapshotPathB = conflationBlkbrdSnapshotsFsUtils.getSnapshotPath(
    targetMap,
    b_timestamp,
  );

  const errMsgs: string[] = [];

  if (!existsSync(snapshotPathA)) {
    errMsgs.push(
      `Conflation blackboard snapshot does not exist for ${targetMap} ${a_timestamp}`,
    );
  }

  if (!existsSync(snapshotPathB)) {
    errMsgs.push(
      `Conflation blackboard snapshot does not exist for ${targetMap} ${b_timestamp}`,
    );
  }

  if (errMsgs.length) {
    throw new Error(errMsgs.join('\n'));
  }

  const diffPath = conflationBlkbrdDiffsFsUtils.getDiffPath(
    targetMap,
    timestamps,
  );

  mkdirSync(dirname(diffPath), { recursive: true });

  diffSnapshots(
    diffPath,
    snapshotPathA,
    snapshotPathB,
    targetMap,
    a_timestamp,
    b_timestamp,
  );
}
