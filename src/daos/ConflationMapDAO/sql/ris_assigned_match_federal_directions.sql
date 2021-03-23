DROP TABLE IF EXISTS __SCHEMA__.ris_assigned_match_federal_directions ;

CREATE TABLE __SCHEMA__.ris_assigned_match_federal_directions (
  nys_ris                         TEXT,
  is_forward                      INTEGER,
  road_number                     INTEGER,
  tds_rc_station                  TEXT,
  tds_federal_direction           INTEGER,
  road_number_federal_direction   INTEGER,

  PRIMARY KEY(nys_ris, is_forward)
) ;
