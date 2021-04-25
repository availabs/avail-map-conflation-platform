/* eslint-disable no-restricted-syntax, no-constant-condition */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { Database as SqliteDatabase, Statement } from 'better-sqlite3';

const DEBUG = false;

export default class AssignerStrategy {
  protected static getSql(fName: string) {
    return readFileSync(join(__dirname, './sql/', fName), {
      encoding: 'utf8',
    });
  }

  protected superStep: number;

  protected previousConstraintsViolationTableNames: string[];

  private preparedStatements: {
    targetMapIsCenterlineStmt?: Statement;
    assignedMatchesCountStmt?: Statement;
    disputeClaimantsCountStmt?: Statement;
    resolvePreferredUnidirectionalStmt?: Statement;
    resolveTrimmableUntrimmableStmt?: Statement;
    resolveEpsilonDisputesStmt?: Statement;
    resolveEpsilonOverlapDisputesStmt?: Statement;
    assignmentAggregateStatsStmt?: Statement;
  };

  constructor(private readonly db: SqliteDatabase) {
    this.preparedStatements = {};

    this.superStep = 0;
    this.previousConstraintsViolationTableNames = [];
  }

  createConstraintViolationsTable(stepLabel: string) {
    if (!DEBUG) {
      return;
    }

    const n = _.padStart(`${this.superStep}`, 3, '0');

    const tableName = `new_constraint_violations_superstep_${n}_${stepLabel}`;

    const previousViolationsUnionsClause = this.previousConstraintsViolationTableNames.map(
      (prevTableName) => `
              SELECT * FROM ${prevTableName}`,
    ).join(`

              UNION ALL
      `);

    const exceptClause = previousViolationsUnionsClause
      ? `
          EXCEPT

          SELECT
              *
            FROM (${previousViolationsUnionsClause}
            )
      `
      : '';

    const sql = `
      CREATE TABLE ${tableName}
        AS
          SELECT
              *
            FROM constraint_violations_in_assigned_matches
          ${exceptClause}
    `;

    this.db.exec(sql);

    const numNewConstraintViolations = this.db
      .prepare(
        `
      SELECT COUNT(1) FROM ${tableName};
    `,
      )
      .pluck()
      .get();

    console.log();
    console.log(
      stepLabel,
      'added',
      numNewConstraintViolations,
      'constraint violations.',
    );
    console.log();

    this.previousConstraintsViolationTableNames.push(tableName);
  }

  resolveDisputes() {
    let curDisputeClaimantsCount = this.disputeClaimantsCount;

    this.createConstraintViolationsTable('initial');

    // let i = 0;
    while (true) {
      console.log('==> curDisputeClaimantsCount:', curDisputeClaimantsCount);

      this.settleDisputes();
      this.createConstraintViolationsTable('loop_start_settle_disputes');

      ++this.superStep;
      this.resolveSameEdgeDisputes();
      this.settleDisputes();
      this.createConstraintViolationsTable('resolve_same_edge_disputes');

      this.resolvePreferredUnidirectional();
      this.settleDisputes();
      ++this.superStep;
      this.createConstraintViolationsTable('resolve_preferred_unidirectional');

      // if (!i) {
      // this.resolveReverseDirections();
      // }

      this.resolveTrimmableUntrimmable();
      this.settleDisputes();
      ++this.superStep;
      this.createConstraintViolationsTable(
        'resolve_trimmable_untrimmable_disputes',
      );

      this.resolveEpsilonDisputes();
      this.settleDisputes();
      ++this.superStep;
      this.createConstraintViolationsTable('resolve_epsilon_disputes');

      // this.resolveUsingViableShstMatches();
      // this.settleDisputes();

      if (curDisputeClaimantsCount === this.disputeClaimantsCount) {
        break;
      }

      curDisputeClaimantsCount = this.disputeClaimantsCount;

      // ++i;
    }

    this.resolveUsingShstReferenceMetadata();

    this.outputAssignmentAggregateStats();

    // Currently, this just creates a table for analysis of the method's potential
    // this.resolveEpsilonOverlapDisputes();
  }

  protected get targetMapIsCenterlineStmt() {
    this.preparedStatements.targetMapIsCenterlineStmt =
      this.preparedStatements.targetMapIsCenterlineStmt ||
      this.db.prepare(`
        SELECT
            metadata
          FROM target_map.target_map_metadata ;
      `);

    return this.preparedStatements.targetMapIsCenterlineStmt;
  }

  get targetMapIsCenterline() {
    const targetMapMetadata = JSON.parse(
      this.targetMapIsCenterlineStmt.pluck().get(),
    );

    return !!targetMapMetadata.targetMapIsCenterline;
  }

  protected get disputeClaimantsCountStmt() {
    this.preparedStatements.disputeClaimantsCountStmt =
      this.preparedStatements.disputeClaimantsCountStmt ||
      this.db.prepare(`
        SELECT
            COUNT(1)
          FROM chosen_match_unresolved_disputes_claimants
      `);

    return this.preparedStatements.disputeClaimantsCountStmt;
  }

  get disputeClaimantsCount() {
    return this.disputeClaimantsCountStmt.pluck().get();
  }

  protected get assignedMatchesCountStmt() {
    this.preparedStatements.assignedMatchesCountStmt =
      this.preparedStatements.assignedMatchesCountStmt ||
      this.db.prepare(`
        SELECT
            COUNT(1)
          FROM awarded_matches
      `);

    return this.preparedStatements.assignedMatchesCountStmt;
  }

  get assignedMatchesCount() {
    return this.assignedMatchesCountStmt.pluck().get();
  }

  protected settleDisputes() {
    const sql = AssignerStrategy.getSql('drop_disputes_and_assign.sql');

    let curDisputeClaimantsCount = this.disputeClaimantsCount;

    console.log(
      'settleDisputes before assignedMatchesCount:',
      this.assignedMatchesCount,
    );

    while (true) {
      console.log(
        'settleDisputes curDisputeClaimantsCount:',
        curDisputeClaimantsCount,
      );

      this.db.exec(sql);

      if (curDisputeClaimantsCount === this.disputeClaimantsCount) {
        break;
      }

      curDisputeClaimantsCount = this.disputeClaimantsCount;
    }

    console.log(
      'settleDisputes after assignedMatchesCount:',
      this.assignedMatchesCount,
    );
  }

  protected resolveSameEdgeDisputes() {
    const sql = AssignerStrategy.getSql('resolve_same_edge_disputes.sql');

    this.db.exec(sql);
  }

  protected resolvePreferredUnidirectional() {
    const sql = AssignerStrategy.getSql('resolve_preferred_unidirectional.sql');

    this.db.exec(sql);
  }

  protected resolveReverseDirections() {
    const sql = AssignerStrategy.getSql('resolve_reverse_directions.sql');

    this.db.exec(sql);
  }

  protected resolveTrimmableUntrimmable() {
    const sql = AssignerStrategy.getSql(
      'resolve_trimmable_untrimmable_disputes.sql',
    );

    this.db.exec(sql);
  }

  protected resolveEpsilonDisputes() {
    const sql = AssignerStrategy.getSql('resolve_epsilon_disputes.sql');

    this.db.exec(sql);
  }

  protected resolveEpsilonOverlapDisputes() {
    const sql = AssignerStrategy.getSql('resolve_epsilon_overlap_disputes.sql');

    this.db.exec(sql);
  }

  protected resolveUsingShstReferenceMetadata() {
    console.log('### targetMapIsCenterline:', this.targetMapIsCenterline);
    if (this.targetMapIsCenterline) {
      const sql = AssignerStrategy.getSql(
        'resolve_using_shst_reference_metadata.sql',
      );

      console.time('resolveUsingShstReferenceMetadata');
      this.db.exec(sql);
      console.timeEnd('resolveUsingShstReferenceMetadata');
    }
  }

  protected get assignmentAggregateStatsStmt() {
    this.preparedStatements.assignmentAggregateStatsStmt =
      this.preparedStatements.assignmentAggregateStatsStmt ||
      this.db.prepare(`
        SELECT
            *
          FROM assigned_matches_aggregate_stats
      `);

    return this.preparedStatements.assignmentAggregateStatsStmt;
  }

  get assignmentAggregateStats() {
    return this.assignmentAggregateStatsStmt.get();
  }

  protected outputAssignmentAggregateStats() {
    console.table(this.assignmentAggregateStats);
  }

  // FIXME: This needs work.
  // protected resolveUsingViableShstMatches() {
  // const sql = AssignerStrategy.getSql(
  // 'resolve_using_viable_shst_matches.sql',
  // );

  // this.db.exec(sql);
  // }
}
