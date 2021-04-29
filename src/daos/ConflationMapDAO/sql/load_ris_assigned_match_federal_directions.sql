BEGIN;

DROP TABLE IF EXISTS conflation_map.ris_assigned_match_federal_directions ;

CREATE TABLE conflation_map.ris_assigned_match_federal_directions (
  nys_ris                         TEXT,
  is_forward                      INTEGER,

  tds_rc_station                  TEXT,
  tds_federal_direction           INTEGER,

  PRIMARY KEY(nys_ris, is_forward)
) ;

INSERT INTO conflation_map.ris_assigned_match_federal_directions (
    nys_ris,
    is_forward,
    tds_rc_station,
    tds_federal_direction
  )
  SELECT
       target_map_id AS nys_ris,
       is_forward,

       tds_rc_station,

       getFederalDirection(
         target_map_path_bearing,
         is_forward,
         tds_federal_directions
       ) AS tds_federal_direction

     FROM (
       SELECT DISTINCT
           e.target_map_id,

           d.is_forward,

           json_extract(a.properties, '$.targetMapPathBearing') AS target_map_path_bearing,

           json_extract(feature, '$.properties.tds_rc_station') AS tds_rc_station,

           json_extract(feature, '$.properties.tds_federal_directions') AS tds_federal_directions,

           NULLIF(json_extract(feature, '$.properties.route_no'), 0) AS road_number,

           rank() OVER (
             PARTITION BY
               e.target_map_id,
               d.is_forward
             ORDER BY
               b.path_edge_idx DESC
           ) AS path_len_rnk

         FROM nys_ris.target_map_ppg_paths AS a
           INNER JOIN nys_ris.target_map_ppg_path_last_edges AS b
             USING (path_id)
           INNER JOIN nys_ris_bb.target_map_edge_chosen_matches AS c
             USING (path_id)
           INNER JOIN nys_ris_bb.target_map_edge_assigned_matches AS d
             ON (
               ( c.edge_id = d.edge_id )
               AND
               ( c.is_forward = d.is_forward )
               AND
               ( c.shst_reference = d.shst_reference_id)
             )
           INNER JOIN nys_ris.target_map_ppg_edge_id_to_target_map_id AS e
             ON ( d.edge_id = e.edge_id )
           INNER JOIN nys_ris.raw_target_map_features AS f
             USING (target_map_id)
     )
     WHERE ( path_len_rnk = 1 ) ;

COMMIT;
