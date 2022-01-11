DROP TABLE IF EXISTS test_map.raw_target_map_features ;

CREATE TABLE test_map.raw_target_map_features (
  target_map_id   TEXT PRIMARY KEY,
  feature         TEXT NOT NULL
) WITHOUT ROWID;

