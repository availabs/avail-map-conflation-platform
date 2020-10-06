DROP TABLE IF EXISTS __SCHEMA__.tmc_identification;

CREATE TABLE __SCHEMA__.tmc_identification (
    tmc                 TEXT NOT NULL PRIMARY KEY,
    type                TEXT NOT NULL,
    road                TEXT,
    road_order          REAL,
    intersection        TEXT,
    tmclinear           INTEGER,
    country             TEXT NOT NULL,
    state               TEXT NOT NULL,
    county              TEXT NOT NULL,
    zip                 TEXT,
    direction           TEXT,
    start_latitude      REAL NOT NULL,
    start_longitude     REAL NOT NULL,
    end_latitude        REAL NOT NULL,
    end_longitude       REAL NOT NULL,
    miles               REAL NOT NULL,
    frc                 INTEGER,
    border_set          TEXT,
    isprimary           INTEGER,
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
    type              TEXT,
    roadnumber        TEXT,
    roadname          TEXT,
    firstname         TEXT,
    lineartmc         TEXT NOT NULL,
    country           TEXT,
    state             TEXT,
    county            TEXT,
    zip               TEXT,
    direction         TEXT,
    --  startlat      INTEGER,
    --  startlong     INTEGER,
    --  endlat        INTEGER,
    --  endlong       INTEGER,
    --  miles         INTEGER,
    frc               INTEGER,
    feature           TEXT NOT NULL --JSON
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
          json(b.feature),
          '$.properties',
          json_object(
            'tmc',                a.tmc,
            'type',               a.type,
            'road',               a.road,
            'road_order',         a.road_order,
            'intersection',       a.intersection,
            'tmclinear',          a.tmclinear,
            'lineartmc',          b.lineartmc,
            'country',            a.country,
            'state',              a.state,
            'county',             a.county,
            'zip',                a.zip,
            'direction',          a.direction,
            'start_latitude',     a.start_latitude,
            'start_longitude',    a.start_longitude,
            'end_latitude',       a.end_latitude,
            'end_longitude',      a.end_longitude,
            'miles',              a.miles,
            'frc',                a.frc,
            'border_set',         a.border_set,
            'isprimary',          a.isprimary,
            'f_system',           a.f_system,
            'urban_code',         a.urban_code,
            'faciltype',          a.faciltype,
            'structype',          a.structype,
            'thrulanes',          a.thrulanes,
            'route_numb',         a.route_numb,
            'route_sign',         a.route_sign,
            'route_qual',         a.route_qual,
            'altrtename',         a.altrtename,
            'aadt',               a.aadt,
            'aadt_singl',         a.aadt_singl,
            'aadt_combi',         a.aadt_combi,
            'nhs',                a.nhs,
            'nhs_pct',            a.nhs_pct,
            'strhnt_typ',         a.strhnt_typ,
            'strhnt_pct',         a.strhnt_pct,
            'truck',              a.truck,
            'timezone_name',      a.timezone_name,
            'active_start_date',  a.active_start_date,
            'active_end_date',    a.active_end_date
          )
        ) as feature
    FROM tmc_identification as a
      INNER JOIN npmrds_shapefile as b USING(tmc)
