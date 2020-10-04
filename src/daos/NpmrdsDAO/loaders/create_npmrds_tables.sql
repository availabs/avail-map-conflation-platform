DROP TABLE IF EXISTS __SCHEMA__.tmc_identification;

CREATE TABLE __SCHEMA__.tmc_identification (
    tmc                 TEXT PRIMARY KEY,
    type                TEXT,
    road                TEXT,
    road_order          REAL,
    intersection        TEXT,
    tmclinear           INTEGER,
    country             TEXT,
    state               TEXT,
    county              TEXT,
    zip                 TEXT,
    direction           TEXT,
    start_latitude      REAL,
    start_longitude     REAL,
    end_latitude        REAL,
    end_longitude       REAL,
    miles               REAL,
    frc                 INTEGER,
    border_set          TEXT,
    isprimary           smallint,
    f_system            INTEGER,
    urban_code          INTEGER,
    faciltype           INTEGER,
    structype           INTEGER,
    thrulanes           INTEGER,
    route_numb          INTEGER,
    route_sign          INTEGER,
    route_qual          INTEGER,
    altrtename          TEXT,
    aadt                INTEGER,
    aadt_singl          INTEGER,
    aadt_combi          INTEGER,
    nhs                 INTEGER,
    nhs_pct             INTEGER,
    strhnt_typ          INTEGER,
    strhnt_pct          INTEGER,
    truck               INTEGER,
    timezone_name       TEXT,
    active_start_date   TEXT,
    active_end_date     TEXT
) WITHOUT ROWID;

DROP TABLE IF EXISTS __SCHEMA__.npmrds_shapefile ;

CREATE TABLE __SCHEMA__.npmrds_shapefile (
  tmc               TEXT PRIMARY KEY,
  geojson_feature   TEXT NOT NULL --JSON
) WITHOUT ROWID;

-- Create a spatial index on the geometry
DROP TABLE IF EXISTS __SCHEMA__.npmrds_shapefile_geopoly_idx;

CREATE VIRTUAL TABLE __SCHEMA__.npmrds_shapefile_geopoly_idx
  USING geopoly(tmc) ;

DROP VIEW IF EXISTS __SCHEMA__.npmrds_features ;

CREATE VIEW __SCHEMA__.npmrds_features
  AS
    SELECT
        tmc,
        json_set(
          json(geojson_feature),
          '$.properties',
          json_object(
            'tmc',                tmc,
            'type',               type,
            'road',               road,
            'road_order',         road_order,
            'intersection',       intersection,
            'tmclinear',          tmclinear,
            'country',            country,
            'state',              state,
            'county',             county,
            'zip',                zip,
            'direction',          direction,
            'start_latitude',     start_latitude,
            'start_longitude',    start_longitude,
            'end_latitude',       end_latitude,
            'end_longitude',      end_longitude,
            'miles',              miles,
            'frc',                frc,
            'border_set',         border_set,
            'isprimary',          isprimary,
            'f_system',           f_system,
            'urban_code',         urban_code,
            'faciltype',          faciltype,
            'structype',          structype,
            'thrulanes',          thrulanes,
            'route_numb',         route_numb,
            'route_sign',         route_sign,
            'route_qual',         route_qual,
            'altrtename',         altrtename,
            'aadt',               aadt,
            'aadt_singl',         aadt_singl,
            'aadt_combi',         aadt_combi,
            'nhs',                nhs,
            'nhs_pct',            nhs_pct,
            'strhnt_typ',         strhnt_typ,
            'strhnt_pct',         strhnt_pct,
            'truck',              truck,
            'timezone_name',      timezone_name,
            'active_start_date',  active_start_date,
            'active_end_date',    active_end_date
          )
        ) as feature
    FROM tmc_identification
    INNER JOIN npmrds_shapefile USING(tmc)
