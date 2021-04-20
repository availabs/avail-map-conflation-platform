/* eslint-disable no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Database as SqliteDatabase, Statement } from 'better-sqlite3';

export default class AssignerStrategy {
  private preparedStatements: {
    numAssignedMatchesStmt?: Statement;
    resolvePreferredUnidirectionalStmt?: Statement;
    resolveTrimmableUntrimmableStmt?: Statement;
    resolveEpsilonDisputesStmt?: Statement;
    resolveEpsilonOverlapDisputesStmt?: Statement;
  };

  constructor(private readonly db: SqliteDatabase) {
    this.preparedStatements = {};
  }

  resolveDisputes() {
    let curNumAssignedMatches = this.numAssignedMatches;

    while (true) {
      console.log('==> curNumAssignedMatches:', curNumAssignedMatches);

      this.settleDisputes();

      this.resolveSameEdgeDisputes();
      this.settleDisputes();

      this.resolvePreferredUnidirectional();
      this.settleDisputes();

      this.resolveTrimmableUntrimmable();
      this.settleDisputes();

      this.resolveEpsilonDisputes();
      this.settleDisputes();

      if (curNumAssignedMatches === this.numAssignedMatches) {
        break;
      }

      curNumAssignedMatches = this.numAssignedMatches;
    }

    this.resolveEpsilonOverlapDisputes();
  }

  protected get numAssignedMatchesStmt() {
    this.preparedStatements.numAssignedMatchesStmt =
      this.preparedStatements.numAssignedMatchesStmt ||
      this.db.prepare(`
        SELECT
            COUNT(1)
          FROM assigned_matches
      `);

    return this.preparedStatements.numAssignedMatchesStmt;
  }

  get numAssignedMatches() {
    return this.numAssignedMatchesStmt.pluck().get();
  }

  static readonly settleDisputesSql = readFileSync(
    join(__dirname, './sql/drop_disputes_and_assign.sql'),
    {
      encoding: 'utf8',
    },
  );

  protected settleDisputes() {
    // Multiple statements so cannot use db.prepare
    let curNumAssignedMatches = this.numAssignedMatches;

    while (true) {
      this.db.exec(AssignerStrategy.settleDisputesSql);

      if (curNumAssignedMatches === this.numAssignedMatches) {
        break;
      }

      curNumAssignedMatches = this.numAssignedMatches;
    }
  }

  protected static readonly resolveSameEdgeDisputesSql = readFileSync(
    join(__dirname, './sql/resolve_same_edge_disputes.sql'),
    {
      encoding: 'utf8',
    },
  );

  protected resolveSameEdgeDisputes() {
    // Multiple statements so cannot use db.prepare
    this.db.exec(AssignerStrategy.resolveSameEdgeDisputesSql);
  }

  protected static readonly resolvePreferredUnidirectionalSql = readFileSync(
    join(__dirname, './sql/resolve_preferred_unidirectional.sql'),
    {
      encoding: 'utf8',
    },
  );

  protected get resolvePreferredUnidirectionalStmt() {
    this.preparedStatements.resolvePreferredUnidirectionalStmt =
      this.preparedStatements.resolvePreferredUnidirectionalStmt ||
      this.db.prepare(AssignerStrategy.resolvePreferredUnidirectionalSql);

    return this.preparedStatements.resolvePreferredUnidirectionalStmt;
  }

  protected resolvePreferredUnidirectional() {
    this.resolvePreferredUnidirectionalStmt.run();
  }

  protected static readonly resolveTrimmableUntrimmableSql = readFileSync(
    join(__dirname, './sql/resolve_trimmable_untrimmable_disputes.sql'),
    {
      encoding: 'utf8',
    },
  );

  protected resolveTrimmableUntrimmable() {
    this.db.exec(AssignerStrategy.resolveTrimmableUntrimmableSql);
  }

  protected static readonly resolveEpsilonDisputesSql = readFileSync(
    join(__dirname, './sql/resolve_epsilon_disputes.sql'),
    {
      encoding: 'utf8',
    },
  );

  protected get resolveEpsilonDisputesStmt() {
    this.preparedStatements.resolveEpsilonDisputesStmt =
      this.preparedStatements.resolveEpsilonDisputesStmt ||
      this.db.prepare(AssignerStrategy.resolveEpsilonDisputesSql);

    return this.preparedStatements.resolveEpsilonDisputesStmt;
  }

  protected resolveEpsilonDisputes() {
    this.resolveEpsilonDisputesStmt.run();
  }

  protected static readonly resolveEpsilonOverlapDisputesSql = readFileSync(
    join(__dirname, './sql/resolve_epsilon_overlap_disputes.sql'),
    {
      encoding: 'utf8',
    },
  );

  protected get resolveEpsilonOverlapDisputesStmt() {
    this.preparedStatements.resolveEpsilonOverlapDisputesStmt =
      this.preparedStatements.resolveEpsilonOverlapDisputesStmt ||
      this.db.prepare(AssignerStrategy.resolveEpsilonOverlapDisputesSql);

    return this.preparedStatements.resolveEpsilonOverlapDisputesStmt;
  }

  protected resolveEpsilonOverlapDisputes() {
    this.resolveEpsilonOverlapDisputesStmt.run();
  }
}
