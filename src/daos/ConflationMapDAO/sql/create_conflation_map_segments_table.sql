DROP TABLE IF EXISTS __SCHEMA__.conflation_map_segments;

CREATE TABLE __SCHEMA__.conflation_map_segments (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,

  shst                    TEXT NOT NULL,

  shst_reference_length   REAL NOT NULL,

  road_class              INTEGER NOT NULL,

  partition_start_dist    REAL NOT NULL,

  partition_end_dist      REAL NOT NULL,

  osm                     TEXT NOT NULL, -- JSON

  nys_ris                 TEXT, -- JSON

  npmrds                  TEXT, -- JSON

  CHECK(shst_reference_length > 0),

  CHECK(road_class BETWEEN 0 AND 8),

  CHECK(partition_start_dist < partition_end_dist),
  CHECK(partition_start_dist >= 0),
  CHECK(partition_end_dist <= shst_reference_length),

  CHECK(
    ( json_type(osm, '$.targetMapId') = 'integer' )
    AND
    ( json_extract(osm, '$.isForward') BETWEEN 0 AND 1 )
    AND
    ( json_extract(osm, '$.sectionStart') <  json_extract(osm, '$.sectionEnd') )
    AND
    ( json_extract(osm, '$.sectionStart') < partition_end_dist  )
    AND
    ( json_extract(osm, '$.sectionEnd') > partition_start_dist )
  ),

  CHECK(
    ( nys_ris IS NULL )
    OR
    (
      ( json_type(nys_ris, '$.targetMapId') = 'integer' )
      AND
      ( json_extract(nys_ris, '$.isForward') BETWEEN 0 AND 1 )
      AND
      ( json_extract(nys_ris, '$.sectionStart') <  json_extract(nys_ris, '$.sectionEnd') )
      AND
      ( json_extract(nys_ris, '$.sectionStart') < partition_end_dist  )
      AND
      ( json_extract(nys_ris, '$.sectionEnd') > partition_start_dist )
    )
  ),

  CHECK(
    ( npmrds IS NULL )
    OR
    (
      ( json_type(npmrds, '$.targetMapId') = 'text' )
      AND
      ( json_extract(npmrds, '$.isForward') BETWEEN 0 AND 1 )
      AND
      ( json_extract(npmrds, '$.sectionStart') <  json_extract(npmrds, '$.sectionEnd') )
      AND
      ( json_extract(npmrds, '$.sectionStart') < partition_end_dist  )
      AND
      ( json_extract(npmrds, '$.sectionEnd') > partition_start_dist )
    )
  )
) ;

CREATE INDEX __SCHEMA__.conflation_map_segments_shst_ref_idx
  ON conflation_map_segments (shst);
