BEGIN ;

DROP TABLE IF EXISTS test_map_qa.ground_truth ;

CREATE TABLE test_map_qa.ground_truth (
  shst_reference  TEXT PRIMARY KEY,
  edge_id         INTEGER NOT NULL,
  section_start   REAL NOT NULL,
  section_end     REAL NOT NULL,

  UNIQUE (edge_id),
  CHECK (section_start = 0)
) WITHOUT ROWID ;

INSERT INTO test_map_qa.ground_truth (
  shst_reference,
  edge_id,
  section_start,
  section_end
)
  SELECT
      json_extract(feature, '$.properties.targetMapId') AS shst_reference,
      edge_id,
      0 AS section_start,
      json_extract(feature, '$.properties.targetMapEdgeLength') AS section_end
    FROM test_map.target_map_ppg_edge_line_features
;

DROP TABLE IF EXISTS test_map_qa.target_map_edge_metadata ;

CREATE TABLE test_map_qa.target_map_edge_metadata (
  edge_id               INTEGER PRIMARY KEY,
  shst_reference        TEXT NOT NULL,
  road_class            TEXT NOT NULL,
  form_of_way           TEXT NOT NULL,
  raw_path_id           TEXT NOT NULL,

  target_map_path_id    INTEGER NOT NULL,
  target_map_path_idx   INTEGER NOT NULL,
  target_map_path_place TEXT NOT NULL,

  UNIQUE (shst_reference)
) WITHOUT ROWID ;


DROP TABLE IF EXISTS test_map_qa.assigned_match_analysis ;

CREATE TABLE test_map_qa.assigned_match_analysis (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,

  shst_reference    TEXT NOT NULL,

  edge_id           INTEGER,

  section_start     REAL NOT NULL,
  section_end       REAL NOT NULL,

  match_taxonomy    TEXT NOT NULL,

  UNIQUE ( shst_reference, section_start, section_end ),

  CHECK  ( json_type(match_taxonomy) = 'array' )
) ;

INSERT INTO test_map_qa.assigned_match_analysis (
  shst_reference,
  edge_id,
  section_start,
  section_end,
  match_taxonomy
)
  SELECT
      b.shst_reference_id,
      b.edge_id,
      b.section_start,
      b.section_end,
      json('["MATCH", "COMPLETE"]') AS match_taxonomy
    FROM test_map.target_map_ppg_edge_line_features AS a
      INNER JOIN test_map_bb.target_map_edge_assigned_matches AS b
        USING (edge_id)
    WHERE (
      ( json_extract(a.feature, '$.properties.targetMapId') = b.shst_reference_id )
      AND
      ( b.section_start < 0.0001 )
      AND
      (
        (
          json_extract(a.feature, '$.properties.targetMapEdgeLength')
            - b.section_end
        ) < 0.0001
      )
    )
;

INSERT INTO test_map_qa.assigned_match_analysis (
  shst_reference,
  edge_id,
  section_start,
  section_end,
  match_taxonomy
)
  SELECT
      b.shst_reference_id,
      b.edge_id,
      b.section_start,
      b.section_end,
      json('["MATCH", "INCOMPLETE", "TRIMMED", "START"]') AS match_taxonomy
    FROM test_map.target_map_ppg_edge_line_features AS a
      INNER JOIN test_map_bb.target_map_edge_assigned_matches AS b
        USING (edge_id)
    WHERE (
      ( json_extract(a.feature, '$.properties.targetMapId') = b.shst_reference_id )
      AND
      ( b.section_start >= 0.0001 )
      AND
      (
        (
          json_extract(feature, '$.properties.targetMapEdgeLength')
          - b.section_end
        ) < 0.0001
      )
    )
;

INSERT INTO test_map_qa.assigned_match_analysis (
  shst_reference,
  edge_id,
  section_start,
  section_end,
  match_taxonomy
)
  SELECT
      b.shst_reference_id,
      b.edge_id,
      b.section_start,
      b.section_end,
      json('["MATCH", "INCOMPLETE", "TRIMMED", "END"]') AS match_taxonomy
    FROM test_map.target_map_ppg_edge_line_features AS a
      INNER JOIN test_map_bb.target_map_edge_assigned_matches AS b
        USING (edge_id)
    WHERE (
      ( json_extract(a.feature, '$.properties.targetMapId') = b.shst_reference_id )
      AND
      ( b.section_start < 0.0001 )
      AND
      (
        (
          json_extract(feature, '$.properties.targetMapEdgeLength')
          - b.section_end
        ) >= 0.0001
      )
    )
;

INSERT INTO test_map_qa.assigned_match_analysis (
  shst_reference,
  edge_id,
  section_start,
  section_end,
  match_taxonomy
)
  SELECT
      b.shst_reference_id,
      b.edge_id,
      b.section_start,
      b.section_end,
      json('["MISMATCH"]') AS match_taxonomy
    FROM test_map_qa.ground_truth AS a
      INNER JOIN test_map_bb.target_map_edge_assigned_matches AS b
        USING (edge_id)
    WHERE ( a.shst_reference <> b.shst_reference_id )
;

INSERT INTO test_map_qa.assigned_match_analysis (
  shst_reference,
  section_start,
  section_end,
  match_taxonomy
)
  SELECT
      a.shst_reference,
      a.section_start,
      a.section_end,
      json('["UNMATCHED", "COMPLETE"]') AS match_taxonomy
    FROM test_map_qa.ground_truth AS a
      LEFT OUTER JOIN test_map_bb.target_map_edge_assigned_matches AS b
        ON ( a.shst_reference = b.shst_reference_id )
    WHERE ( b.shst_reference_id IS NULL )
;


COMMIT ;

VACUUM test_map_qa ;
