DROP TABLE IF EXISTS __SCHEMA__.nys_ris;

CREATE TABLE __SCHEMA__.nys_ris (
  fid                           INTEGER PRIMARY KEY,
  region                        INTEGER NOT NULL,
  gis_id                        INTEGER NOT NULL,
  dot_id                        INTEGER NOT NULL,
  direction                     INTEGER NOT NULL,
  region_co                     INTEGER NOT NULL,
  fips_co                       INTEGER NOT NULL,
  county_name                   TEXT NOT NULL,
  county                        TEXT NOT NULL,
  route                         TEXT,
  signing                       TEXT,
  route_no                      INTEGER,
  suffix                        TEXT,
  co_rd                         TEXT,
  road_name                     TEXT,
  begin_description             TEXT,
  end_description               TEXT,
  county_order                  INTEGER,
  beg_mp                        REAL NOT NULL,
  end_mp                        REAL NOT NULL,
  section_length                REAL NOT NULL,
  muni_geocode                  INTEGER,
  muni_type                     TEXT,
  muni_name                     TEXT,
  jurisdiction                  TEXT,
  owning_jurisdiction           TEXT,
  muni_owner_geocode            INTEGER,
  muni_owner_type               TEXT,
  muni_owner_name               TEXT,
  functional_class              INTEGER NOT NULL,
  federal_aid_highway__stp_er_  TEXT,
  nhs_value                     TEXT,
  "primary"                     TEXT,
  f1991_fed_aid_primary         TEXT,
  strahnet                      TEXT,
  urban_area_code_id            INTEGER,
  urban_area_name               TEXT,
  hpms_ua_code                  INTEGER,
  mpo_desc                      TEXT,
  overlap_id                    TEXT,
  overlap_hierarchy             INTEGER,
  ris_divided_area_id           INTEGER,
  hpms_sample_id                INTEGER,
  sh_num                        TEXT,
  ref_marker                    TEXT,
  residency                     TEXT,
  total_lanes                   INTEGER,
  primary_dir_lanes             INTEGER,
  divided                       TEXT,
  oneway                        TEXT,
  access_control                TEXT,
  scenic_byway                  TEXT,
  trail_crossing                TEXT,
  toll                          TEXT,
  toll_facility                 TEXT,
  parkway                       TEXT,
  grouped_road_flag             TEXT,
  rest_area                     TEXT,
  discontinuous_road_flag       TEXT,
  reservation_desc              TEXT,
  tandem_truck                  TEXT,
  bin_number                    TEXT,
  bridge_disp_desc              TEXT,
  extra_bridges                 TEXT,
  hov                           TEXT,
  hov_lanes                     INTEGER,
  railroad_crossing             TEXT,
  area                          TEXT,
  culture                       TEXT,
  passing                       INTEGER,
  parking                       TEXT,
  posted_speed_limit            INTEGER,
  ccstn                         INTEGER,
  station_num                   INTEGER,
  aadt_current_yr_est           INTEGER,
  aadt_actual                   INTEGER,
  last_actual_cntyr             INTEGER,
  ddhv                          INTEGER,
  ddhv_factor                   INTEGER,
  adj_cap                       INTEGER,
  v_c                           REAL,
  avg_pct_trucks                INTEGER,
  actual_pct_trucks             INTEGER,
  actual_pct_year               INTEGER,
  total_through_lane_width      REAL,
  pavement_type_value           TEXT,
  shoulder_width                REAL,
  shoulder_type                 TEXT,
  median_width                  INTEGER,
  median_type                   TEXT,
  base                          TEXT,
  sub_base_type                 TEXT,
  last_overlay                  REAL,
  crack_seal_yr                 INTEGER,
  work_yr                       INTEGER,
  work_type                     TEXT,
  yr_scored                     INTEGER,
  ss_2007                       TEXT,
  ss_2008                       TEXT,
  ss_2009                       TEXT,
  ss_2010                       TEXT,
  ss_2011                       TEXT,
  ss_2012                       TEXT,
  ss_2013                       TEXT,
  ss_2014                       TEXT,
  ss_2015                       TEXT,
  ss_2016                       TEXT,
  ss_2017                       TEXT,
  dom_distr                     TEXT,
  iri                           INTEGER,
  iri_year                      INTEGER,
  i_rut_depth                   REAL,
  rut_year                      INTEGER,
  i_no_of_bumps                 INTEGER,
  bump_cnt_year                 INTEGER,
  max_bump_height               REAL,
  bump_max_year                 INTEGER,
  avg_bump_height               REAL,
  bump_avg_year                 INTEGER,
  pci                           INTEGER,
  roadway_type                  TEXT,
  onramp_from_roadway           TEXT,
  offramp_from_roadway          TEXT,
  ramp_interchange_code         TEXT,
  ramp_alpha_suffix             TEXT,
  ramp_orig_dot_id              TEXT,
  ramp_orig_co_order            INTEGER,
  ramp_orig_mp                  REAL,
  ramp_dest_dot_id              TEXT,
  ramp_dest_co_order            INTEGER,
  ramp_dest_mp                  REAL,
  segment_type                  TEXT,
  k_factor                      REAL,
  d_factor                      REAL,
  percent_peak_single_unit      REAL,
  percent_peak_combp            REAL,
  aadt_single_unit              INTEGER,
  aadt_combo                    INTEGER,
  pavement_layer                INTEGER,
  shape_length                  REAL,
  feature                       TEXT,

  UNIQUE (gis_id, beg_mp),
  UNIQUE (gis_id, end_mp),

  CHECK(json_valid(feature) OR feature IS NULL),

  CHECK (beg_mp < end_mp),
  CHECK (direction = 1 OR direction = 2),
  CHECK (functional_class IN (1, 2, 4, 6, 7, 8, 9, 11, 12, 14, 16, 17, 18, 19))
) WITHOUT ROWID;

DROP INDEX IF EXISTS __SCHEMA__.nys_ris_roadname_idx ;

CREATE INDEX __SCHEMA__.nys_ris_roadname_idx
  ON nys_ris (road_name) ;

DROP INDEX IF EXISTS __SCHEMA__.nys_ris_begin_description_idx ;

CREATE INDEX __SCHEMA__.nys_ris_begin_description_idx
  ON nys_ris (begin_description) ;

DROP INDEX IF EXISTS __SCHEMA__.nys_ris_end_description_idx ;

CREATE INDEX __SCHEMA__.nys_ris_end_description_idx
  ON nys_ris (end_description) ;

-- Create a spatial index on the geometry
DROP TABLE IF EXISTS __SCHEMA__.nys_ris_geopoly_idx;

CREATE VIRTUAL TABLE __SCHEMA__.nys_ris_geopoly_idx
  USING geopoly(fid) ;

DROP TABLE IF EXISTS __SCHEMA__._qa_nys_ris_entries_without_geometries ;

CREATE TABLE __SCHEMA__._qa_nys_ris_entries_without_geometries (
  fid         INTEGER PRIMARY KEY,
  properties  TEXT NOT NULL,

  CHECK (json_valid(properties))
) WITHOUT ROWID;

DROP TABLE IF EXISTS __SCHEMA__.nys_traffic_counts_station_year_directions;
DROP TABLE IF EXISTS __SCHEMA__.fhwa_direction_of_travel_code_descriptions ;

CREATE TABLE __SCHEMA__.fhwa_direction_of_travel_code_descriptions (
  federal_direction  INTEGER PRIMARY KEY,
  description        TEXT NOT NULL
) WITHOUT ROWID;

INSERT INTO __SCHEMA__.fhwa_direction_of_travel_code_descriptions (
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

CREATE TABLE __SCHEMA__.nys_traffic_counts_station_year_directions (
  rc_station         TEXT,
  year               INTEGER,
  federal_direction  INTEGER,

  PRIMARY KEY (rc_station, year, federal_direction),

  FOREIGN KEY(federal_direction)
    REFERENCES fhwa_direction_of_travel_code_descriptions(federal_direction)
) WITHOUT ROWID ;

DROP TABLE IF EXISTS __SCHEMA__.ris_segment_federal_directions ;

CREATE TABLE __SCHEMA__.ris_segment_federal_directions (
  fid                 INTEGER PRIMARY KEY,
  rc_station          TEXT,
  traffic_count_year  INTEGER,
  federal_directions  TEXT, -- JSON

  FOREIGN KEY(fid) REFERENCES nys_ris(fid)
) WITHOUT ROWID;


DROP VIEW IF EXISTS __SCHEMA__.raw_target_map_features ;

CREATE VIEW __SCHEMA__.raw_target_map_features
  AS
    SELECT
        fid AS target_map_id,
        json_set(
          json_set(
            json(feature),
            '$.properties',
            -- Need to use patch because there is a limit on the number of fields using json_object.
            json_patch(
              json_patch(
                json_object(
                  'fid',                           fid,
                  'region',                        region,
                  'gis_id',                        gis_id,
                  'dot_id',                        dot_id,
                  'direction',                     direction,
                  'region_co',                     region_co,
                  'fips_co',                       fips_co,
                  'county_name',                   county_name,
                  'county',                        county,
                  'route',                         route,
                  'signing',                       signing,
                  'route_no',                      route_no,
                  'suffix',                        suffix,
                  'co_rd',                         co_rd,
                  'road_name',                     road_name,
                  'begin_description',             begin_description,
                  'end_description',               end_description,
                  'county_order',                  county_order,
                  'beg_mp',                        beg_mp,
                  'end_mp',                        end_mp,
                  'section_length',                section_length,
                  'muni_geocode',                  muni_geocode,
                  'muni_type',                     muni_type,
                  'muni_name',                     muni_name,
                  'jurisdiction',                  jurisdiction,
                  'owning_jurisdiction',           owning_jurisdiction,
                  'muni_owner_geocode',            muni_owner_geocode,
                  'muni_owner_type',               muni_owner_type,
                  'muni_owner_name',               muni_owner_name
                ),
                json_object(
                  'functional_class',              functional_class,
                  'federal_aid_highway__stp_er_',  federal_aid_highway__stp_er_,
                  'nhs_value',                     nhs_value,
                  'primary',                       "primary",
                  'f1991_fed_aid_primary',         f1991_fed_aid_primary,
                  'strahnet',                      strahnet,
                  'urban_area_code_id',            urban_area_code_id,
                  'urban_area_name',               urban_area_name,
                  'hpms_ua_code',                  hpms_ua_code,
                  'mpo_desc',                      mpo_desc,
                  'overlap_id',                    overlap_id,
                  'overlap_hierarchy',             overlap_hierarchy,
                  'ris_divided_area_id',           ris_divided_area_id,
                  'hpms_sample_id',                hpms_sample_id,
                  'sh_num',                        sh_num,
                  'ref_marker',                    ref_marker,
                  'residency',                     residency,
                  'total_lanes',                   total_lanes,
                  'primary_dir_lanes',             primary_dir_lanes,
                  'divided',                       divided,
                  'oneway',                        oneway,
                  'access_control',                access_control,
                  'scenic_byway',                  scenic_byway,
                  'trail_crossing',                trail_crossing,
                  'toll',                          toll,
                  'toll_facility',                 toll_facility,
                  'parkway',                       parkway,
                  'grouped_road_flag',             grouped_road_flag,
                  'rest_area',                     rest_area,
                  'discontinuous_road_flag',       discontinuous_road_flag,
                  'reservation_desc',              reservation_desc,
                  'tandem_truck',                  tandem_truck,
                  'bin_number',                    bin_number,
                  'bridge_disp_desc',              bridge_disp_desc,
                  'extra_bridges',                 extra_bridges,
                  'hov',                           hov,
                  'hov_lanes',                     hov_lanes,
                  'railroad_crossing',             railroad_crossing,
                  'area',                          area,
                  'culture',                       culture,
                  'passing',                       passing,
                  'parking',                       parking,
                  'posted_speed_limit',            posted_speed_limit,
                  'ccstn',                         ccstn,
                  'station_num',                   station_num
                )
              ),
              json_patch(
                json_object(
                  'aadt_current_yr_est',           aadt_current_yr_est,
                  'aadt_actual',                   aadt_actual,
                  'last_actual_cntyr',             last_actual_cntyr,
                  'ddhv',                          ddhv,
                  'ddhv_factor',                   ddhv_factor,
                  'adj_cap',                       adj_cap,
                  'v_c',                           v_c,
                  'avg_pct_trucks',                avg_pct_trucks,
                  'actual_pct_trucks',             actual_pct_trucks,
                  'actual_pct_year',               actual_pct_year,
                  'total_through_lane_width',      total_through_lane_width,
                  'pavement_type_value',           pavement_type_value,
                  'shoulder_width',                shoulder_width,
                  'shoulder_type',                 shoulder_type,
                  'median_width',                  median_width,
                  'median_type',                   median_type,
                  'base',                          base,
                  'sub_base_type',                 sub_base_type,
                  'last_overlay',                  last_overlay,
                  'crack_seal_yr',                 crack_seal_yr,
                  'work_yr',                       work_yr,
                  'work_type',                     work_type,
                  'yr_scored',                     yr_scored,
                  'ss_2007',                       ss_2007,
                  'ss_2008',                       ss_2008,
                  'ss_2009',                       ss_2009,
                  'ss_2010',                       ss_2010,
                  'ss_2011',                       ss_2011,
                  'ss_2012',                       ss_2012,
                  'ss_2013',                       ss_2013,
                  'ss_2014',                       ss_2014,
                  'ss_2015',                       ss_2015,
                  'ss_2016',                       ss_2016,
                  'ss_2017',                       ss_2017
                ),
                json_object(
                  'dom_distr',                     dom_distr,
                  'iri',                           iri,
                  'iri_year',                      iri_year,
                  'i_rut_depth',                   i_rut_depth,
                  'rut_year',                      rut_year,
                  'i_no_of_bumps',                 i_no_of_bumps,
                  'bump_cnt_year',                 bump_cnt_year,
                  'max_bump_height',               max_bump_height,
                  'bump_max_year',                 bump_max_year,
                  'avg_bump_height',               avg_bump_height,
                  'bump_avg_year',                 bump_avg_year,
                  'pci',                           pci,
                  'roadway_type',                  roadway_type,
                  'onramp_from_roadway',           onramp_from_roadway,
                  'offramp_from_roadway',          offramp_from_roadway,
                  'ramp_interchange_code',         ramp_interchange_code,
                  'ramp_alpha_suffix',             ramp_alpha_suffix,
                  'ramp_orig_dot_id',              ramp_orig_dot_id,
                  'ramp_orig_co_order',            ramp_orig_co_order,
                  'ramp_orig_mp',                  ramp_orig_mp,
                  'ramp_dest_dot_id',              ramp_dest_dot_id,
                  'ramp_dest_co_order',            ramp_dest_co_order,
                  'ramp_dest_mp',                  ramp_dest_mp,
                  'segment_type',                  segment_type,
                  'k_factor',                      k_factor,
                  'd_factor',                      d_factor,
                  'percent_peak_single_unit',      percent_peak_single_unit,
                  'percent_peak_combp',            percent_peak_combp,
                  'aadt_single_unit',              aadt_single_unit,
                  'aadt_combo',                    aadt_combo,
                  'pavement_layer',                pavement_layer,
                  'shape_length',                  shape_length,
                  'tds_rc_station',                tds.rc_station,
                  'tds_traffic_count_year',        tds.traffic_count_year,
                  'tds_federal_directions',        json(tds.federal_directions)
                )
              )
            )
          ),
          '$.id',
          fid
        ) as feature
    FROM nys_ris
      INNER JOIN ris_segment_federal_directions AS tds
        USING (fid)
    WHERE ( feature IS NOT NULL )
;
