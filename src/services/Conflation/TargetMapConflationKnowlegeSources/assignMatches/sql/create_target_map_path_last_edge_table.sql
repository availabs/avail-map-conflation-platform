BEGIN;

DROP TABLE IF EXISTS target_map_path_last_edge_idx ;

CREATE TABLE target_map_path_last_edge_idx (
  path_id             INTEGER PRIMARY KEY,
  last_edge_idx       INTEGER NOT NULL
) WITHOUT ROWID;

INSERT INTO target_map_path_last_edge_idx
  SELECT
      path_id,
      MAX(path_edge_idx) AS last_edge_idx
    FROM target_map.target_map_ppg_path_edges
    GROUP BY (path_id)
;
COMMIT;
