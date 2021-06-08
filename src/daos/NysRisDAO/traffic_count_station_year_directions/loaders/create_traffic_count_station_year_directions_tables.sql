DROP TABLE IF EXISTS nys_ris.nys_traffic_counts_station_year_directions ;
DROP TABLE IF EXISTS nys_ris.fhwa_direction_of_travel_code_descriptions ;
DROP TABLE IF EXISTS nys_ris.ris_segment_federal_directions ;


CREATE TABLE nys_ris.fhwa_direction_of_travel_code_descriptions (
  federal_direction  INTEGER PRIMARY KEY,
  description        TEXT NOT NULL
) WITHOUT ROWID;

INSERT INTO nys_ris.fhwa_direction_of_travel_code_descriptions (
  federal_direction,
  description
) VALUES
  ( 1 , 'North'),
  ( 2 , 'Northeast'),
  ( 3 , 'East'),
  ( 4 , 'Southeast'),
  ( 5 , 'South'),
  ( 6 , 'Southwest'),
  ( 7 , 'West'),
  ( 8 , 'Northwest')
;

CREATE TABLE nys_ris.nys_traffic_counts_station_year_directions (
  rc_station         TEXT,
  year               INTEGER,
  federal_direction  INTEGER,

  PRIMARY KEY (rc_station, year, federal_direction),

  FOREIGN KEY(federal_direction)
    REFERENCES fhwa_direction_of_travel_code_descriptions(federal_direction)
) WITHOUT ROWID ;

CREATE TABLE nys_ris.ris_segment_federal_directions (
  fid                 INTEGER PRIMARY KEY,
  rc_station          TEXT,
  traffic_count_year  INTEGER,
  federal_directions  TEXT -- JSON

  --  FOREIGN KEY(fid) REFERENCES roadway_inventory_system(fid)
) WITHOUT ROWID;
