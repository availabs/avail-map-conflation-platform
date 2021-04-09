/* eslint-disable no-restricted-syntax */

import { Database as SqliteDatabase } from 'better-sqlite3';

import loadChosenMatchDisputes from './utils/loadChosenMatchDisputes';
import loadTrimmabilityTable from './utils/loadTrimmabilityTable';
import createAssignedMatchesTable from './utils/createAssignedMatchesTable';

import AssignerWorkDatabaseService from './AssignerWorkDatabaseService';
import AssignerStrategy from './AssignerStrategy';

import { TargetMapSchema } from '../../../../utils/TargetMapDatabases/TargetMapDAO';
import { AssignedMatch } from '../../domain/types';

export default class AssignerController {
  readonly db: SqliteDatabase;

  private readonly assignerStrategy: AssignerStrategy;

  assign: () => void;

  constructor(readonly targetMapSchema: TargetMapSchema) {
    this.db = AssignerWorkDatabaseService.createTemporaryWorkDatabaseConnection(
      targetMapSchema,
    );

    this.initializeCoreDatabaseTables();

    this.assignerStrategy = new AssignerStrategy(this.db);

    this.assign = this.assignerStrategy.resolveDisputes.bind(
      this.assignerStrategy,
    );
  }

  initializeCoreDatabaseTables() {
    loadChosenMatchDisputes(this.db);
    loadTrimmabilityTable(this.db);
    createAssignedMatchesTable(this.db);
  }

  *makeMatchesIterator(): Generator<AssignedMatch> {
    // Undisputed ChosenMatches
    const undisputedChosenMatchesIter = this.db
      .prepare(
        `
          SELECT
              a.shst_reference  AS shstReferenceId,
              a.edge_id         AS targetMapEdgeId,
              a.is_forward      AS isForward,
              a.section_start   AS sectionStart,
              a.section_end     AS sectionEnd
            FROM target_map_bb.target_map_edge_chosen_matches AS a
              LEFT OUTER JOIN chosen_match_dispute_claimants_initial AS b
                USING (
                  path_id,
                  path_edge_idx,
                  is_forward,
                  edge_shst_match_idx
                )
            WHERE ( b.dispute_id IS NULL )
      `,
      )
      .iterate();

    for (const row of undisputedChosenMatchesIter) {
      yield row;
    }

    // Disputed ChosenMatches Resolutions
    const assignedMatchIter = this.db
      .prepare(
        `
          SELECT
              shst_reference_id   AS shstReferenceId,
              edge_id             AS targetMapEdgeId,
              is_forward          AS isForward,
              section_start       AS sectionStart,
              section_end         AS sectionEnd
            FROM assigned_matches

            ORDER BY shst_reference_id, section_start ;
        `,
      )
      .iterate();

    for (const row of assignedMatchIter) {
      yield row;
    }
  }
}
