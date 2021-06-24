-- FIXME: Replace INNER JOINs with OUTER JOINs where possible.

BEGIN;

DROP TABLE IF EXISTS conflation_map.ris_assigned_match_federal_directions ;

CREATE TABLE conflation_map.ris_assigned_match_federal_directions (
  nys_ris                         TEXT,
  is_forward                      INTEGER,

  tds_rc_station                  TEXT,
  tds_federal_direction           INTEGER,

  PRIMARY KEY(nys_ris, is_forward)
) ;

DROP TABLE IF EXISTS conflation_map.tmp_path_data ;

CREATE TABLE conflation_map.tmp_path_data (
  path_id                     INTEGER PRIMARY KEY,
  target_map_path_bearing     REAL,
  last_path_edge_idx          INTEGER NOT NULL
) WITHOUT ROWID;

INSERT INTO conflation_map.tmp_path_data (
  path_id,
  target_map_path_bearing,
  last_path_edge_idx
)
  SELECT
      path_id,
      json_extract(a.properties, '$.targetMapPathBearing') AS target_map_path_bearing,
      b.path_edge_idx AS last_path_edge_idx
    FROM nys_ris.target_map_ppg_paths AS a

      INNER JOIN nys_ris.target_map_ppg_path_last_edges AS b
        USING (path_id)
;

ANALYZE conflation_map.tmp_path_data ;

DROP TABLE IF EXISTS conflation_map.tmp_assigned_match_data ;

CREATE TABLE conflation_map.tmp_assigned_match_data (
  path_id             INTEGER NOT NULL,
  nys_ris             TEXT NOT NULL,
  is_forward          INTEGER NOT NULL
) ;

INSERT INTO conflation_map.tmp_assigned_match_data (
  path_id,
  nys_ris,
  is_forward
)
  SELECT
      a.path_id,
      c.target_map_id AS nys_ris,
      a.is_forward
    FROM nys_ris_bb.target_map_edge_chosen_matches AS a
      INNER JOIN nys_ris_bb.target_map_edge_assigned_matches AS b
        ON (
          ( a.edge_id = b.edge_id )
          AND
          ( a.is_forward = b.is_forward )
          AND
          ( a.shst_reference = b.shst_reference_id)
        )
      INNER JOIN nys_ris.target_map_ppg_edge_id_to_target_map_id AS c
        ON ( a.edge_id = c.edge_id )
;

CREATE INDEX conflation_map.tmp_assigned_match_data_path_id_idx
  ON tmp_assigned_match_data (path_id) ;

CREATE INDEX conflation_map.tmp_assigned_match_data_ris_id_idx
  ON tmp_assigned_match_data (nys_ris) ;

ANALYZE conflation_map.tmp_assigned_match_data ;

DROP TABLE IF EXISTS conflation_map.tmp_tds_data ;

CREATE TABLE conflation_map.tmp_tds_data (
  nys_ris                 TEXT PRIMARY KEY,
  tds_rc_station          TEXT,
  tds_federal_directions  INTEGER
) WITHOUT ROWID ;

INSERT INTO conflation_map.tmp_tds_data (
  nys_ris,
  tds_rc_station,
  tds_federal_directions
)
  SELECT
      target_map_id AS nys_ris,
      json_extract(feature, '$.properties.tds_rc_station') AS tds_rc_station,
      json_extract(feature, '$.properties.tds_federal_directions') AS tds_federal_directions
    FROM nys_ris.raw_target_map_features
;

ANALYZE conflation_map.tmp_tds_data ;

INSERT INTO conflation_map.ris_assigned_match_federal_directions (
    nys_ris,
    is_forward,
    tds_rc_station,
    tds_federal_direction
  )
  SELECT
       nys_ris,
       is_forward,

       tds_rc_station,

       getFederalDirection(
         target_map_path_bearing,
         is_forward,
         tds_federal_directions
       ) AS tds_federal_direction

    FROM (
      SELECT DISTINCT
          a.nys_ris,
          a.is_forward,
          b.target_map_path_bearing,
          c.tds_rc_station,
          c.tds_federal_directions,

          rank() OVER (
            PARTITION BY
              a.nys_ris,
              a.is_forward
            ORDER BY
              b.last_path_edge_idx DESC
          ) AS path_len_rnk

        FROM conflation_map.tmp_assigned_match_data AS a
          INNER JOIN conflation_map.tmp_path_data AS b
            USING (path_id)
          INNER JOIN conflation_map.tmp_tds_data AS c
            USING (nys_ris)
    )
    WHERE ( path_len_rnk = 1 ) ;

COMMIT;
