BEGIN;

/*
CREATE TABLE __SCHEMA__.target_maps_assigned_matches (
  shst_reference_id   INTEGER NOT NULL,

  target_map          TEXT NOT NULL,
  target_map_id       TEXT NOT NULL,

  is_forward          INTEGER NOT NULL,

  section_start       REAL NOT NULL,
  section_end         REAL NOT NULL,

  PRIMARY KEY (
    shst_reference_id,
    target_map,
    target_map_id
  )
*/

DROP TABLE IF EXISTS __SCHEMA__.qa_nys_ris_lengths ;

CREATE TABLE __SCHEMA__.qa_nys_ris_lengths (
  nys_ris                                   INTEGER PRIMARY KEY,

  target_map_edge_length                    REAL NOT NULL,

  is_unidirectional                         INTEGER NOT NULL,

  forward_conflation_segments_length_sum    REAL,
  backward_conflation_segments_length_sum   REAL
) WITHOUT ROWID;

INSERT INTO __SCHEMA__.qa_nys_ris_lengths (
    nys_ris,
    target_map_edge_length,
    is_unidirectional,
    forward_conflation_segments_length_sum,
    backward_conflation_segments_length_sum
  )
  SELECT
      json_extract(a.properties, '$.targetMapId') AS nys_ris,
      
      json_extract(a.properties, '$.targetMapEdgeLength') AS target_map_edge_length,

      json_extract(a.properties, '$.isUnidirectional') AS is_unidirectional,

      b.confl_segs_len_sum AS forward_conflation_segments_length_sum,

      c.confl_segs_len_sum AS backward_conflation_segments_length_sum

    FROM __NYS_RIS__.target_map_ppg_edges AS a
      LEFT OUTER JOIN (
        SELECT
            json_extract(nys_ris, '$.targetMapId') AS target_map_id,
            
            SUM(
              partition_end_dist - partition_start_dist
            ) AS confl_segs_len_sum
          FROM __SCHEMA__.conflation_map_segments
          WHERE (
            ( json_extract(nys_ris, '$.isForward') = 1 )
          )
          GROUP BY target_map_id
      ) AS b
        ON ( json_extract(a.properties, '$.targetMapId') = b.target_map_id )
      LEFT OUTER JOIN (
        SELECT
            json_extract(nys_ris, '$.targetMapId') AS target_map_id,
            
            SUM(
              partition_end_dist - partition_start_dist
            ) AS confl_segs_len_sum
          FROM __SCHEMA__.conflation_map_segments
          WHERE (
            ( json_extract(nys_ris, '$.isForward') = 0 )
          )
          GROUP BY target_map_id
      ) AS c 
        ON ( json_extract(a.properties, '$.targetMapId') = c.target_map_id )
;

DROP TABLE IF EXISTS __SCHEMA__.qa_npmrds_lengths ;

CREATE TABLE __SCHEMA__.qa_npmrds_lengths (
  tmc                                       TEXT PRIMARY KEY,

  target_map_edge_length                    REAL NOT NULL,

  forward_conflation_segments_length_sum    REAL
) WITHOUT ROWID;

INSERT INTO __SCHEMA__.qa_npmrds_lengths (
    tmc,
    target_map_edge_length,
    forward_conflation_segments_length_sum
  )
  SELECT
      json_extract(a.properties, '$.targetMapId') AS tmc,
      
      json_extract(a.properties, '$.targetMapEdgeLength') AS target_map_edge_length,

      c.confl_segs_len_sum AS forward_conflation_segments_length_sum

    FROM __NPMRDS__.target_map_ppg_edges AS a
      INNER JOIN __NPMRDS__.raw_target_map_features AS b
        ON ( json_extract(a.properties, '$.targetMapId') = b.target_map_id )
      LEFT OUTER JOIN (
        SELECT
            json_extract(npmrds, '$.targetMapId') AS target_map_id,
            
            SUM(
              partition_end_dist - partition_start_dist
            ) AS confl_segs_len_sum
          FROM __SCHEMA__.conflation_map_segments
          GROUP BY target_map_id
      ) AS c
        ON ( json_extract(a.properties, '$.targetMapId') = c.target_map_id )
    WHERE ( IFNULL(json_extract(b.feature, '$.properties.isprimary'), 1) )
;

COMMIT;
