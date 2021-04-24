/* eslint-disable no-restricted-syntax, no-constant-condition */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase, Statement } from 'better-sqlite3';

export default class AssignerStrategy {
  protected static getSql(fName: string) {
    return readFileSync(join(__dirname, './sql/', fName), {
      encoding: 'utf8',
    });
  }

  private preparedStatements: {
    assignedMatchesCountStmt?: Statement;
    disputeClaimantsCountStmt?: Statement;
    resolvePreferredUnidirectionalStmt?: Statement;
    resolveTrimmableUntrimmableStmt?: Statement;
    resolveEpsilonDisputesStmt?: Statement;
    resolveEpsilonOverlapDisputesStmt?: Statement;
  };

  constructor(private readonly db: SqliteDatabase) {
    this.preparedStatements = {};
  }

  resolveDisputes() {
    let curDisputeClaimantsCount = this.disputeClaimantsCount;

    // let i = 0;
    while (true) {
      console.log('==> curDisputeClaimantsCount:', curDisputeClaimantsCount);

      this.settleDisputes();

      this.resolveSameEdgeDisputes();
      this.settleDisputes();

      this.resolvePreferredUnidirectional();
      this.settleDisputes();

      // if (!i) {
      // this.resolveReverseDirections();
      // }

      this.resolveTrimmableUntrimmable();
      this.settleDisputes();

      this.resolveEpsilonDisputes();
      this.settleDisputes();

      // this.resolveUsingViableShstMatches();
      // this.settleDisputes();

      if (curDisputeClaimantsCount === this.disputeClaimantsCount) {
        break;
      }

      curDisputeClaimantsCount = this.disputeClaimantsCount;

      // ++i;
    }

    // Currently, this just creates a table for analysis of the method's potential
    // this.resolveEpsilonOverlapDisputes();
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

  // FIXME: This needs work.
  // protected resolveUsingViableShstMatches() {
  // const sql = AssignerStrategy.getSql(
  // 'resolve_using_viable_shst_matches.sql',
  // );

  // this.db.exec(sql);
  // }
}
