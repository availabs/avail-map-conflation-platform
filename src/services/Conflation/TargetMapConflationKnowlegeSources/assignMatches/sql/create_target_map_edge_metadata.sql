/*
  TODO:

    Potential uses:
        1. Use in conjunction with Trimmability and AvgDeviance to identify Knaves
*/

BEGIN;

CREATE TABLE target_map_edge_metadata (
  edge_id                   INTEGER PRIMARY KEY,
  target_map_id             TEXT NOT NULL,
  is_unidirectional         INTEGER NOT NULL,
  target_map_edge_length    REAL NOT NULL
) WITHOUT ROWID;

INSERT INTO target_map_edge_metadata (
  edge_id,
  target_map_id,
  is_unidirectional,
  target_map_edge_length
)
  SELECT
      edge_id,
      json_extract(properties, '$.targetMapId') AS target_map_id,
      json_extract(properties, '$.isUnidirectional') AS is_unidirectional,
      ROUND(
        json_extract(properties, '$.targetMapEdgeLength'),
        4
      ) AS target_map_edge_lengths
    FROM target_map.target_map_ppg_edges
    ORDER BY edge_id
;

COMMIT;
