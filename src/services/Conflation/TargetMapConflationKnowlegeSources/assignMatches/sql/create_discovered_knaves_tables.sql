-- Knaves: ChosenMatches determined to be unsound.
--   Table is used to filter those "Knaves" out of AssignedMatches.
--
-- Until decision dependency tracking is implemented,
--   only high confidence hypotheses should be inserted, and not deleted
--   to allow further inductions/decisions based on these tables.

BEGIN;

DROP TABLE IF EXISTS discovered_knaves;

CREATE TABLE discovered_knaves (
  shst_reference_id   TEXT NOT NULL,

  edge_id             INTEGER NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL NOT NULL,
  section_end         REAL NOT NULL,

  PRIMARY KEY(
    shst_reference_id,
    edge_id,
    is_forward,
    section_start,
    section_end
  )
) WITHOUT ROWID ;

CREATE INDEX discovered_knaves_sections_idx
  ON discovered_knaves (
    shst_reference_id,
    section_start,
    section_end
  ) ;

COMMIT;
