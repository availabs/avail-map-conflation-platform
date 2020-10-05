import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import db from '../../../services/DbService';

import getBufferPolygonCoords from '../../../utils/getBufferPolygonCoords';

import { NYS_RIS as SCHEMA } from '../../../constants/databaseSchemaNames';

import { handleNysRisGeometryIrregularBoundingPolygon } from './anomalyHandlers';

const nysRisColumns = [
  'fid',
  'region',
  'gis_id',
  'dot_id',
  'direction',
  'region_co',
  'fips_co',
  'county_name',
  'county',
  'route',
  'signing',
  'route_no',
  'suffix',
  'co_rd',
  'road_name',
  'begin_description',
  'end_description',
  'county_order',
  'beg_mp',
  'end_mp',
  'section_length',
  'muni_geocode',
  'muni_type',
  'muni_name',
  'jurisdiction',
  'owning_jurisdiction',
  'muni_owner_geocode',
  'muni_owner_type',
  'muni_owner_name',
  'functional_class',
  'federal_aid_highway__stp_er_',
  'nhs_value',
  '"primary"',
  'f1991_fed_aid_primary',
  'strahnet',
  'urban_area_code_id',
  'urban_area_name',
  'hpms_ua_code',
  'mpo_desc',
  'overlap_id',
  'overlap_hierarchy',
  'ris_divided_area_id',
  'hpms_sample_id',
  'sh_num',
  'ref_marker',
  'residency',
  'total_lanes',
  'primary_dir_lanes',
  'divided',
  'oneway',
  'access_control',
  'scenic_byway',
  'trail_crossing',
  'toll',
  'toll_facility',
  'parkway',
  'grouped_road_flag',
  'rest_area',
  'discontinuous_road_flag',
  'reservation_desc',
  'tandem_truck',
  'bin_number',
  'bridge_disp_desc',
  'extra_bridges',
  'hov',
  'hov_lanes',
  'railroad_crossing',
  'area',
  'culture',
  'passing',
  'parking',
  'posted_speed_limit',
  'ccstn',
  'station_num',
  'aadt_current_yr_est',
  'aadt_actual',
  'last_actual_cntyr',
  'ddhv',
  'ddhv_factor',
  'adj_cap',
  'v_c',
  'avg_pct_trucks',
  'actual_pct_trucks',
  'actual_pct_year',
  'total_through_lane_width',
  'pavement_type_value',
  'shoulder_width',
  'shoulder_type',
  'median_width',
  'median_type',
  'base',
  'sub_base_type',
  'last_overlay',
  'crack_seal_yr',
  'work_yr',
  'work_type',
  'yr_scored',
  'ss_2007',
  'ss_2008',
  'ss_2009',
  'ss_2010',
  'ss_2011',
  'ss_2012',
  'ss_2013',
  'ss_2014',
  'ss_2015',
  'ss_2016',
  'ss_2017',
  'dom_distr',
  'iri',
  'iri_year',
  'i_rut_depth',
  'rut_year',
  'i_no_of_bumps',
  'bump_cnt_year',
  'max_bump_height',
  'bump_max_year',
  'avg_bump_height',
  'bump_avg_year',
  'pci',
  'roadway_type',
  'onramp_from_roadway',
  'offramp_from_roadway',
  'ramp_interchange_code',
  'ramp_alpha_suffix',
  'ramp_orig_dot_id',
  'ramp_orig_co_order',
  'ramp_orig_mp',
  'ramp_dest_dot_id',
  'ramp_dest_co_order',
  'ramp_dest_mp',
  'segment_type',
  'k_factor',
  'd_factor',
  'percent_peak_single_unit',
  'percent_peak_combp',
  'aadt_single_unit',
  'aadt_combo',
  'pavement_layer',
  'shape_length',
  'feature',
];

const createNysRisTables = (xdb: any) => {
  const sql = readFileSync(join(__dirname, './create_nys_ris_tables.sql'))
    .toString()
    .replace(/__SCHEMA__/g, SCHEMA);

  xdb.exec(sql);
};

const insertNysRisEntry = (xdb: any, { properties, shape }) => {
  const values = nysRisColumns.map((k) => {
    const v = properties?.[k];

    if (k === 'feature') {
      return shape ? JSON.stringify(shape) : null;
    }

    if (_.isNil(v)) {
      return null;
    }

    if (Number.isFinite(+v)) {
      return +v;
    }

    return v;
  });

  xdb
    .prepare(
      `
        INSERT INTO ${SCHEMA}.nys_ris (
          ${nysRisColumns}
        ) VALUES(${nysRisColumns.map(() => '?')}) ;`,
    )
    .run(values);

  if (shape) {
    // Coordinates of the feature's bounding polygon.
    const polyCoords = getBufferPolygonCoords(shape);

    if (polyCoords.length !== 1) {
      handleNysRisGeometryIrregularBoundingPolygon(shape);
    }

    // Inserts only the first set of coordinates.
    // If this INSERT fails, the database is corrupted.
    //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
    xdb
      .prepare(
        `
        INSERT INTO ${SCHEMA}.nys_ris_geopoly_idx (
          _shape,
          fid
        ) VALUES (?, ?) ; `,
      )
      .run([JSON.stringify(_.first(polyCoords)), shape.id]);
  }
};

// https://basarat.gitbook.io/typescript/main-1/typed-event
// eslint-disable-next-line import/prefer-default-export
export async function loadNysRis(nysRisEntryEmitter: any) {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    createNysRisTables(xdb);

    const sentinel = new Promise((resolve, reject) =>
      nysRisEntryEmitter
        .on('entry', insertNysRisEntry.bind(null, xdb))
        .on('done', resolve)
        .on('error', reject),
    );

    await sentinel;

    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
