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
    active_end_date     TEXT,

    -- TODO: Change these to FOREIGN KEY REFERENCES.
    CHECK (
      (f_system IS NULL)
      OR
      (f_system BETWEEN 1 AND 7 )
      OR
      (
        (active_end_date <= '2018-01-01')
        AND
        (f_system = 99)
      )
    ),
    CHECK (
      (faciltype IS NULL)
      OR
      (faciltype BETWEEN 1 AND 6 )
    ),
    CHECK (
      (structype IS NULL)
      OR
      (structype BETWEEN 1 AND 3)
      OR
      (
        (active_end_date <= '2018-01-01')
        AND
        (structype = 0)
      )
    ),
    CHECK (
      (route_sign IS NULL)
      OR
      (route_sign BETWEEN 1 AND 10)
      OR
      (
        (active_end_date <= '2018-01-01')
        AND
        (route_sign = 0)
      )
    ),
    CHECK (
      (route_qual IS NULL)
      OR
      (route_qual BETWEEN 1 AND 10)
      OR
      (
        (active_end_date <= '2018-01-01')
        AND
        (route_qual = 0)
      )
    ),
    CHECK (
      (nhs IS NULL) -- Documentation says [1,9]
      OR
      (nhs BETWEEN -1 AND 9)
    ),
    CHECK (
      (nhs_pct IS NULL)
      OR
      (nhs_pct BETWEEN 0 AND 100 )
    ),
    CHECK (
      (strhnt_typ IS NULL)
      OR
      (strhnt_typ BETWEEN 0 AND 2   )
    ),
    CHECK (
      (strhnt_pct IS NULL)
      OR
      (strhnt_pct  BETWEEN 0 AND 100 )
    )
) WITHOUT ROWID;

DROP TABLE IF EXISTS __SCHEMA__.npmrds_shapefile ;

CREATE TABLE __SCHEMA__.npmrds_shapefile (
    tmc               TEXT PRIMARY KEY,
    type              TEXT,
    roadnumber        TEXT,
    roadname          TEXT,
    firstname         TEXT,
    lineartmc         TEXT,
    country           TEXT,
    state             TEXT,
    county            TEXT,
    zip               TEXT,
    direction         TEXT,
    -- Because these are rounded to INTEGERs, they are useless.
    --  startlat      INTEGER,
    --  startlong     INTEGER,
    --  endlat        INTEGER,
    --  endlong       INTEGER,
    --  miles         INTEGER,
    frc               INTEGER,
    feature           TEXT NOT NULL, --JSON

    CHECK(json(feature) OR 1),
    CHECK (
      CASE json_extract(feature, '$.geometry.type')
        WHEN 'LineString'
          -- https://tools.ietf.org/html/rfc7946#section-3.1.4
          THEN (
            (
              json_array_length(
                json_extract(feature, '$.geometry.coordinates')
              ) >= 2
            )
          )
        WHEN 'MultiLineString'
          -- https://tools.ietf.org/html/rfc7946#section-3.1.5
          THEN (
            -- Also, if coordinates array is length 1, MUST use LineString.
            (
              json_array_length(
                json_extract(feature, '$.geometry.coordinates')
              ) > 1 
            )
            AND
            (
              json_array_length(
                json_extract(feature, '$.geometry.coordinates[0]')
              ) >= 2
            )
            AND
            (
              json_array_length(
                json_extract(feature, '$.geometry.coordinates[#-1]')
              ) >= 2
            )
          )
        ELSE 0
      END
    )
) WITHOUT ROWID;

DROP INDEX IF EXISTS __SCHEMA__.npmrds_shapefile_lineartmc_idx ;

CREATE INDEX __SCHEMA__.npmrds_shapefile_lineartmc_idx
  ON npmrds_shapefile (lineartmc) ;

-- Create a spatial index on the geometry
DROP TABLE IF EXISTS __SCHEMA__.npmrds_shapefile_geopoly_idx;

CREATE VIRTUAL TABLE __SCHEMA__.npmrds_shapefile_geopoly_idx
  USING geopoly(tmc) ;

DROP TABLE IF EXISTS __SCHEMA__._qa_failed_npmrds_shapefile_inserts ;

CREATE TABLE __SCHEMA__._qa_failed_npmrds_shapefile_inserts (
  tmc       TEXT PRIMARY KEY,
  feature   TEXT NOT NULL
) WITHOUT ROWID;

DROP VIEW IF EXISTS __SCHEMA__.raw_target_map_features ;

CREATE VIEW __SCHEMA__.raw_target_map_features
  AS
    SELECT
        tmc AS target_map_id,
        json_set(
          json_set(
            json(b.feature),
            '$.properties',
            json_object(
              '_route_id_',         COALESCE(
                                      b.lineartmc  || ':' || LOWER(REPLACE(a.county, ':', ' ')),
                                      a.tmclinear  || ':' || LOWER(REPLACE(a.county, ':', ' ')),
                                      a.route_numb || ':' || LOWER(REPLACE(a.county, ':', ' ')),
                                      a.tmc
                                    ),
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
          ),
          '$.id',
          tmc
        ) as feature
    FROM tmc_identification as a
      INNER JOIN npmrds_shapefile as b
        USING(tmc)
    WHERE ( IFNULL(a.isprimary, -1) <> 0 )
;
