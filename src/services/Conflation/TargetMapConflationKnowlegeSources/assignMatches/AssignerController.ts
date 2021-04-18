/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase } from 'better-sqlite3';

import loadChosenMatchDisputes from './utils/loadChosenMatchDisputes';

import AssignerWorkDatabaseService from './AssignerWorkDatabaseService';
import AssignerStrategy from './AssignerStrategy';

import { TargetMapSchema } from '../../../../utils/TargetMapDatabases/TargetMapDAO';
import { AssignedMatch } from '../../domain/types';

export default class AssignerController {
  protected static getSql(fName: string) {
    return readFileSync(join(__dirname, './sql/', fName), {
      encoding: 'utf8',
    });
  }

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

  // These tables simply hold information. They do not assign matches.
  initializeCoreDatabaseTables() {
    console.time('initializeCoreDatabaseTables');
    loadChosenMatchDisputes(this.db);
    this.createDiscoveredKnavesTables();
    this.createTargetMapPathLastEdgeTable();
    this.createTargetMapPathEdgeChosenMatchesAggregateStats();
    this.createTargetMapUnidirectionalEdgePreferredDirectionTable();
    this.loadTrimmabilityTable();
    this.createAssignedMatchesTable();
    console.timeEnd('initializeCoreDatabaseTables');
  }

  protected createDiscoveredKnavesTables() {
    const sql = AssignerController.getSql(
      'create_discovered_knaves_tables.sql',
    );

    this.db.exec(sql);
  }

  protected createTargetMapPathLastEdgeTable() {
    const sql = AssignerController.getSql(
      'create_target_map_path_last_edge_table.sql',
    );

    this.db.exec(sql);
  }

  protected createTargetMapPathEdgeChosenMatchesAggregateStats() {
    const sql = AssignerController.getSql(
      'create_target_map_path_edge_chosen_matches_aggregate_stats_table.sql',
    );

    this.db.exec(sql);
  }

  protected createTargetMapUnidirectionalEdgePreferredDirectionTable() {
    const sql = AssignerController.getSql(
      'create_target_map_unidirectional_edge_preferred_direction_table.sql',
    );

    this.db.exec(sql);
  }

  protected loadTrimmabilityTable() {
    const sql = AssignerController.getSql('initialize_trimmability_table.sql');

    this.db.exec(sql);
  }

  protected createAssignedMatchesTable() {
    const sql = AssignerController.getSql('create_assigned_matches_table.sql');

    this.db.exec(sql);
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
              LEFT OUTER JOIN discovered_knaves AS c
                ON (
                  ( a.shst_reference = c.shst_reference_id )
                  AND
                  ( a.edge_id = c.edge_id )
                  AND
                  ( a.is_forward = c.is_forward )
                  AND
                  ( a.section_start < c.section_end )
                  AND
                  ( a.section_end > c.section_start )
                )
            WHERE (
              ( b.path_id IS NULL )
              AND
              ( c.shst_reference_id IS NULL )
            )
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
