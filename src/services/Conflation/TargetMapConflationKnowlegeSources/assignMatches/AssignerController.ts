/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase } from 'better-sqlite3';

import loadChosenMatchDisputes from './utils/loadChosenMatchDisputes';

import AssignerWorkDatabaseService from './AssignerWorkDatabaseService';
import AssignerStrategy from './AssignerStrategy';

import { TargetMapSchema } from '../../../../utils/TargetMapDatabases/TargetMapDAO';
import { AssignedMatch } from '../../domain/types';

function getSql(fName: string) {
  return readFileSync(join(__dirname, './sql/', fName), {
    encoding: 'utf8',
  });
}

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

  // These tables simply hold information. They do not assign matches.
  initializeCoreDatabaseTables() {
    console.time('initializeCoreDatabaseTables');
    loadChosenMatchDisputes(this.db);
    this.createDiscoveredKnavesTables();
    this.createTargetMapPathLastEdgeTable();
    this.createTargetMapEdgeMetadataTable();
    this.createTargetMapPathEdgeChosenMatchesAggregateStats();
    this.createTargetMapUnidirectionalEdgePreferredDirectionTable();
    this.loadTrimmabilityTable();
    this.createAssignedMatchesTable();

    this.createShstMatchesViews();
    this.createShstReferencesMetadataView();
    this.createAssignedMatchesView();

    this.createConstraintSatisfactionViews();
    this.createAssigmentMetricsViews();

    console.timeEnd('initializeCoreDatabaseTables');
  }

  protected createDiscoveredKnavesTables() {
    const sql = getSql('create_discovered_knaves_tables.sql');

    this.db.exec(sql);
  }

  protected createTargetMapPathLastEdgeTable() {
    const sql = getSql('create_target_map_path_last_edge_table.sql');

    this.db.exec(sql);
  }

  protected createTargetMapEdgeMetadataTable() {
    const sql = getSql('create_target_map_edge_metadata.sql');

    this.db.exec(sql);
  }

  protected createTargetMapPathEdgeChosenMatchesAggregateStats() {
    const sql = getSql(
      'create_target_map_path_edge_chosen_matches_aggregate_stats_table.sql',
    );

    this.db.exec(sql);
  }

  protected createTargetMapUnidirectionalEdgePreferredDirectionTable() {
    const sql = getSql(
      'create_target_map_unidirectional_edge_preferred_direction_table.sql',
    );

    this.db.exec(sql);
  }

  protected loadTrimmabilityTable() {
    const sql = getSql('initialize_trimmability_table.sql');

    this.db.exec(sql);
  }

  protected createAssignedMatchesTable() {
    const sql = getSql('create_awarded_matches_table.sql');

    this.db.exec(sql);
  }

  protected createShstMatchesViews() {
    const sql = getSql('create_shst_matches_temporary_views.sql');

    this.db.exec(sql);
  }

  protected createShstReferencesMetadataView() {
    const sql = getSql('create_shst_reference_metadata_view.sql');

    this.db.exec(sql);
  }

  protected createAssignedMatchesView() {
    const sql = getSql('create_assigned_matches_view.sql');

    this.db.exec(sql);
  }

  protected createConstraintSatisfactionViews() {
    const sql = getSql('constraint_satisfaction_views.sql');

    this.db.exec(sql);
  }

  protected createAssigmentMetricsViews() {
    const sql = getSql('create_assignment_metrics_views.sql');

    this.db.exec(sql);
  }

  *makeMatchesIterator(): Generator<AssignedMatch> {
    // Undisputed ChosenMatches
    const iter = this.db
      .prepare(
        `
          SELECT
              shst_reference_id   AS shstReferenceId,
              edge_id             AS targetMapEdgeId,
              is_forward          AS isForward,
              section_start       AS sectionStart,
              section_end         AS sectionEnd
            FROM assigned_matches_view ;
      `,
      )
      .iterate();

    for (const row of iter) {
      yield row;
    }
  }
}
