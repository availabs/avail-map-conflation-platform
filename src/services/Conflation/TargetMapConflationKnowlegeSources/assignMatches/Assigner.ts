import { Database as SqliteDatabase } from 'better-sqlite3';
import DbService from '../../../DbService';

import TargetMapConflationBlackboardDao from '../../TargetMapConflationBlackboardDao';

import identifyChosenMatchDisputes from './utils/identifyChosenMatchDisputes';
import createTrimmabilityTable from './utils/createTrimmabilityTable';
import assignTargetMapEdgeMatches from './utils/assignTargetMapEdgeMatches';

import makeDisputesIterator from './utils/makeDisputesIterator';
import makeDisputedGeometriesIterator from './utils/makeDisputedGeometriesIterator';

import outputDisputes from './utils/outputDisputes';
import outputChosenMatches from './utils/outputChosenMatches';
import outputAssignedMatches from './utils/outputAssignedMatches';

import { RawTargetMapFeature, AssignedMatch } from '../../domain/types';

export default class ChosenMatchesConflictArbitrator {
  private tmpDb: SqliteDatabase;

  makeDisputesIterator: () => Generator<any>;

  makeDisputedGeometriesIterator: () => Generator<any>;

  outputDisputes: () => void;

  outputChosenMatches: () => void;

  constructor(bbDao: TargetMapConflationBlackboardDao<RawTargetMapFeature>) {
    this.tmpDb = DbService.createTemporaryDatabase();

    console.log(this.tmpDb.name);

    // @ts-ignore
    this.tmpDb.unsafeMode(true);

    this.tmpDb.pragma('main.journal_mode = WAL');

    DbService.attachDatabaseToConnection(this.tmpDb, 'source_map');
    DbService.attachDatabaseToConnection(this.tmpDb, 'source_map_structures');

    DbService.attachDatabaseToConnection(
      this.tmpDb,
      bbDao.targetMapSchema,
      null,
      'target_map',
    );

    DbService.attachDatabaseToConnection(
      this.tmpDb,
      bbDao.blkbrdDbSchema,
      null,
      'target_map_bb',
    );

    console.time('createTables');
    identifyChosenMatchDisputes(this.tmpDb);
    createTrimmabilityTable(this.tmpDb);
    console.timeEnd('createTables');

    this.makeDisputesIterator = makeDisputesIterator.bind(null, this.tmpDb);

    this.makeDisputedGeometriesIterator = makeDisputedGeometriesIterator.bind(
      null,
      this.tmpDb,
    );

    this.outputDisputes = outputDisputes.bind(null, this.tmpDb);
    this.outputChosenMatches = outputChosenMatches.bind(null, this.tmpDb);
  }

  makeAssignedMatchesIterator(): Generator<AssignedMatch> {
    assignTargetMapEdgeMatches(this.tmpDb);

    // @ts-ignore
    return this.tmpDb
      .prepare(
        `
          SELECT
              shst_reference_id AS shstReferenceId,

              edge_id AS targetMapEdgeId,

              is_forward AS isForward,

              section_start AS sectionStart,
              section_end AS sectionEnd

            FROM tmp_assigned_matches

            ORDER BY shst_reference_id, section_start
        `,
      )
      .iterate();
  }

  outputAssignedMatches() {
    // NOTE: Async function
    return outputAssignedMatches(
      this.makeAssignedMatchesIterator(),
      this.tmpDb,
    );
  }
}
