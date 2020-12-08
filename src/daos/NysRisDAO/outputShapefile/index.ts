/* eslint-disable no-restricted-syntax */

import { existsSync } from 'fs';

import * as turf from '@turf/turf';

import gdal from 'gdal';

import { sync as rimrafSync } from 'rimraf';

import _ from 'lodash';

import db from '../../../services/DbService';

import { NYS_RIS as SCHEMA } from '../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../utils/TargetMapDatabases/TargetMapDAO';

const targetMapDao = new TargetMapDAO(db, SCHEMA);

// @ts-ignore
const wgs84 = gdal.SpatialReference.fromEPSG(4326);

type gdalOFTType = string;

const addFieldToLayer = (layer: gdal.Layer, name: string, type: gdalOFTType) =>
  layer.fields.add(new gdal.FieldDefn(name, type));

const addRawNysRisLayer = (dataset: gdal.Dataset) => {
  // @ts-ignore
  const layer = dataset.layers.create(
    `raw_nys_ris`,
    wgs84,
    gdal.MultiLineString,
  );

  const propDefs = {
    fid: {
      fieldName: 'fid',
      type: gdal.OFTInteger,
    },
    region: {
      fieldName: 'region',
      type: gdal.OFTInteger,
    },
    gis_id: {
      fieldName: 'gis_id',
      type: gdal.OFTInteger,
    },
    dot_id: {
      fieldName: 'dot_id',
      type: gdal.OFTInteger,
    },
    direction: {
      fieldName: 'direction',
      type: gdal.OFTInteger,
    },
    region_co: {
      fieldName: 'region_co',
      type: gdal.OFTInteger,
    },
    fips_co: {
      fieldName: 'fips_co',
      type: gdal.OFTInteger,
    },
    // county_name: {
    // fieldName: 'county_name',
    // type: gdal.OFTString,
    // },
    // county: {
    // fieldName: 'county',
    // type: gdal.OFTString,
    // },
    // route: {
    // fieldName: 'route',
    // type: gdal.OFTString,
    // },
    // signing: {
    // fieldName: 'signing',
    // type: gdal.OFTString,
    // },
    // route_no: {
    // fieldName: 'route_no',
    // type: gdal.OFTInteger,
    // },
    // suffix: {
    // fieldName: 'suffix',
    // type: gdal.OFTString,
    // },
    // co_rd: {
    // fieldName: 'co_rd',
    // type: gdal.OFTString,
    // },
    // road_name: {
    // fieldName: 'road_name',
    // type: gdal.OFTString,
    // },
    // begin_description: {
    // fieldName: 'begin_description',
    // type: gdal.OFTString,
    // },
    // end_description: {
    // fieldName: 'end_description',
    // type: gdal.OFTString,
    // },
    // county_order: {
    // fieldName: 'county_order',
    // type: gdal.OFTInteger,
    // },
    // beg_mp: {
    // fieldName: 'beg_mp',
    // type: gdal.OFTReal,
    // },
    // end_mp: {
    // fieldName: 'end_mp',
    // type: gdal.OFTReal,
    // },
    // section_length: {
    // fieldName: 'section_length',
    // type: gdal.OFTReal,
    // },
    // muni_geocode: {
    // fieldName: 'muni_geocode',
    // type: gdal.OFTInteger,
    // },
    // muni_type: {
    // fieldName: 'muni_type',
    // type: gdal.OFTString,
    // },
    // muni_name: {
    // fieldName: 'muni_name',
    // type: gdal.OFTString,
    // },
    // jurisdiction: {
    // fieldName: 'jurisdiction',
    // type: gdal.OFTString,
    // },
    // owning_jurisdiction: {
    // fieldName: 'owning_jurisdiction',
    // type: gdal.OFTString,
    // },
    // muni_owner_geocode: {
    // fieldName: 'muni_owner_geocode',
    // type: gdal.OFTInteger,
    // },
    // muni_owner_type: {
    // fieldName: 'muni_owner_type',
    // type: gdal.OFTString,
    // },
    // muni_owner_name: {
    // fieldName: 'muni_owner_name',
    // type: gdal.OFTString,
    // },
    // functional_class: {
    // fieldName: 'functional_class',
    // type: gdal.OFTInteger,
    // },
    // federal_aid_highway__stp_er_: {
    // fieldName: 'federal_aid_highway__stp_er_',
    // type: gdal.OFTString,
    // },
    // nhs_value: {
    // fieldName: 'nhs_value',
    // type: gdal.OFTString,
    // },
    // primary: {
    // fieldName: 'primary',
    // type: gdal.OFTString,
    // },
    // f1991_fed_aid_primary: {
    // fieldName: 'f1991_fed_aid_primary',
    // type: gdal.OFTString,
    // },
    // strahnet: {
    // fieldName: 'strahnet',
    // type: gdal.OFTString,
    // },
    // urban_area_code_id: {
    // fieldName: 'urban_area_code_id',
    // type: gdal.OFTInteger,
    // },
    // urban_area_name: {
    // fieldName: 'urban_area_name',
    // type: gdal.OFTString,
    // },
    // hpms_ua_code: {
    // fieldName: 'hpms_ua_code',
    // type: gdal.OFTInteger,
    // },
    // mpo_desc: {
    // fieldName: 'mpo_desc',
    // type: gdal.OFTString,
    // },
    // overlap_id: {
    // fieldName: 'overlap_id',
    // type: gdal.OFTString,
    // },
    // overlap_hierarchy: {
    // fieldName: 'overlap_hierarchy',
    // type: gdal.OFTInteger,
    // },
    // ris_divided_area_id: {
    // fieldName: 'ris_divided_area_id',
    // type: gdal.OFTInteger,
    // },
    // hpms_sample_id: {
    // fieldName: 'hpms_sample_id',
    // type: gdal.OFTInteger,
    // },
    // sh_num: {
    // fieldName: 'sh_num',
    // type: gdal.OFTString,
    // },
    // ref_marker: {
    // fieldName: 'ref_marker',
    // type: gdal.OFTString,
    // },
    // residency: {
    // fieldName: 'residency',
    // type: gdal.OFTString,
    // },
    // total_lanes: {
    // fieldName: 'total_lanes',
    // type: gdal.OFTInteger,
    // },
    // primary_dir_lanes: {
    // fieldName: 'primary_dir_lanes',
    // type: gdal.OFTInteger,
    // },
    // divided: {
    // fieldName: 'divided',
    // type: gdal.OFTString,
    // },
    // oneway: {
    // fieldName: 'oneway',
    // type: gdal.OFTString,
    // },
    // access_control: {
    // fieldName: 'access_control',
    // type: gdal.OFTString,
    // },
    // scenic_byway: {
    // fieldName: 'scenic_byway',
    // type: gdal.OFTString,
    // },
    // trail_crossing: {
    // fieldName: 'trail_crossing',
    // type: gdal.OFTString,
    // },
    // toll: {
    // fieldName: 'toll',
    // type: gdal.OFTString,
    // },
    // toll_facility: {
    // fieldName: 'toll_facility',
    // type: gdal.OFTString,
    // },
    // parkway: {
    // fieldName: 'parkway',
    // type: gdal.OFTString,
    // },
    // grouped_road_flag: {
    // fieldName: 'grouped_road_flag',
    // type: gdal.OFTString,
    // },
    // rest_area: {
    // fieldName: 'rest_area',
    // type: gdal.OFTString,
    // },
    // discontinuous_road_flag: {
    // fieldName: 'discontinuous_road_flag',
    // type: gdal.OFTString,
    // },
    // reservation_desc: {
    // fieldName: 'reservation_desc',
    // type: gdal.OFTString,
    // },
    // tandem_truck: {
    // fieldName: 'tandem_truck',
    // type: gdal.OFTString,
    // },
    // bin_number: {
    // fieldName: 'bin_number',
    // type: gdal.OFTString,
    // },
    // bridge_disp_desc: {
    // fieldName: 'bridge_disp_desc',
    // type: gdal.OFTString,
    // },
    // extra_bridges: {
    // fieldName: 'extra_bridges',
    // type: gdal.OFTString,
    // },
    // hov: {
    // fieldName: 'hov',
    // type: gdal.OFTString,
    // },
    // hov_lanes: {
    // fieldName: 'hov_lanes',
    // type: gdal.OFTInteger,
    // },
    // railroad_crossing: {
    // fieldName: 'railroad_crossing',
    // type: gdal.OFTString,
    // },
    // area: {
    // fieldName: 'area',
    // type: gdal.OFTString,
    // },
    // culture: {
    // fieldName: 'culture',
    // type: gdal.OFTString,
    // },
    // passing: {
    // fieldName: 'passing',
    // type: gdal.OFTInteger,
    // },
    // parking: {
    // fieldName: 'parking',
    // type: gdal.OFTString,
    // },
    // posted_speed_limit: {
    // fieldName: 'posted_speed_limit',
    // type: gdal.OFTInteger,
    // },
    // ccstn: {
    // fieldName: 'ccstn',
    // type: gdal.OFTInteger,
    // },
    // station_num: {
    // fieldName: 'station_num',
    // type: gdal.OFTInteger,
    // },
    // aadt_current_yr_est: {
    // fieldName: 'aadt_current_yr_est',
    // type: gdal.OFTInteger,
    // },
    // aadt_actual: {
    // fieldName: 'aadt_actual',
    // type: gdal.OFTInteger,
    // },
    // last_actual_cntyr: {
    // fieldName: 'last_actual_cntyr',
    // type: gdal.OFTInteger,
    // },
    // ddhv: {
    // fieldName: 'ddhv',
    // type: gdal.OFTInteger,
    // },
    // ddhv_factor: {
    // fieldName: 'ddhv_factor',
    // type: gdal.OFTInteger,
    // },
    // adj_cap: {
    // fieldName: 'adj_cap',
    // type: gdal.OFTInteger,
    // },
    // v_c: {
    // fieldName: 'v_c',
    // type: gdal.OFTReal,
    // },
    // avg_pct_trucks: {
    // fieldName: 'avg_pct_trucks',
    // type: gdal.OFTInteger,
    // },
    // actual_pct_trucks: {
    // fieldName: 'actual_pct_trucks',
    // type: gdal.OFTInteger,
    // },
    // actual_pct_year: {
    // fieldName: 'actual_pct_year',
    // type: gdal.OFTInteger,
    // },
    // total_through_lane_width: {
    // fieldName: 'total_through_lane_width',
    // type: gdal.OFTReal,
    // },
    // pavement_type_value: {
    // fieldName: 'pavement_type_value',
    // type: gdal.OFTString,
    // },
    // shoulder_width: {
    // fieldName: 'shoulder_width',
    // type: gdal.OFTReal,
    // },
    // shoulder_type: {
    // fieldName: 'shoulder_type',
    // type: gdal.OFTString,
    // },
    // median_width: {
    // fieldName: 'median_width',
    // type: gdal.OFTInteger,
    // },
    // median_type: {
    // fieldName: 'median_type',
    // type: gdal.OFTString,
    // },
    // base: {
    // fieldName: 'base',
    // type: gdal.OFTString,
    // },
    // sub_base_type: {
    // fieldName: 'sub_base_type',
    // type: gdal.OFTString,
    // },
    // last_overlay: {
    // fieldName: 'last_overlay',
    // type: gdal.OFTReal,
    // },
    // crack_seal_yr: {
    // fieldName: 'crack_seal_yr',
    // type: gdal.OFTInteger,
    // },
    // work_yr: {
    // fieldName: 'work_yr',
    // type: gdal.OFTInteger,
    // },
    // work_type: {
    // fieldName: 'work_type',
    // type: gdal.OFTString,
    // },
    // yr_scored: {
    // fieldName: 'yr_scored',
    // type: gdal.OFTInteger,
    // },
    // ss_2007: {
    // fieldName: 'ss_2007',
    // type: gdal.OFTString,
    // },
    // ss_2008: {
    // fieldName: 'ss_2008',
    // type: gdal.OFTString,
    // },
    // ss_2009: {
    // fieldName: 'ss_2009',
    // type: gdal.OFTString,
    // },
    // ss_2010: {
    // fieldName: 'ss_2010',
    // type: gdal.OFTString,
    // },
    // ss_2011: {
    // fieldName: 'ss_2011',
    // type: gdal.OFTString,
    // },
    // ss_2012: {
    // fieldName: 'ss_2012',
    // type: gdal.OFTString,
    // },
    // ss_2013: {
    // fieldName: 'ss_2013',
    // type: gdal.OFTString,
    // },
    // ss_2014: {
    // fieldName: 'ss_2014',
    // type: gdal.OFTString,
    // },
    // ss_2015: {
    // fieldName: 'ss_2015',
    // type: gdal.OFTString,
    // },
    // ss_2016: {
    // fieldName: 'ss_2016',
    // type: gdal.OFTString,
    // },
    // ss_2017: {
    // fieldName: 'ss_2017',
    // type: gdal.OFTString,
    // },
    // dom_distr: {
    // fieldName: 'dom_distr',
    // type: gdal.OFTString,
    // },
    // iri: {
    // fieldName: 'iri',
    // type: gdal.OFTInteger,
    // },
    // iri_year: {
    // fieldName: 'iri_year',
    // type: gdal.OFTInteger,
    // },
    // i_rut_depth: {
    // fieldName: 'i_rut_depth',
    // type: gdal.OFTReal,
    // },
    // rut_year: {
    // fieldName: 'rut_year',
    // type: gdal.OFTInteger,
    // },
    // i_no_of_bumps: {
    // fieldName: 'i_no_of_bumps',
    // type: gdal.OFTInteger,
    // },
    // bump_cnt_year: {
    // fieldName: 'bump_cnt_year',
    // type: gdal.OFTInteger,
    // },
    // max_bump_height: {
    // fieldName: 'max_bump_height',
    // type: gdal.OFTReal,
    // },
    // bump_max_year: {
    // fieldName: 'bump_max_year',
    // type: gdal.OFTInteger,
    // },
    // avg_bump_height: {
    // fieldName: 'avg_bump_height',
    // type: gdal.OFTReal,
    // },
    // bump_avg_year: {
    // fieldName: 'bump_avg_year',
    // type: gdal.OFTInteger,
    // },
    // pci: {
    // fieldName: 'pci',
    // type: gdal.OFTInteger,
    // },
    // roadway_type: {
    // fieldName: 'roadway_type',
    // type: gdal.OFTString,
    // },
    // onramp_from_roadway: {
    // fieldName: 'onramp_from_roadway',
    // type: gdal.OFTString,
    // },
    // offramp_from_roadway: {
    // fieldName: 'offramp_from_roadway',
    // type: gdal.OFTString,
    // },
    // ramp_interchange_code: {
    // fieldName: 'ramp_interchange_code',
    // type: gdal.OFTString,
    // },
    // ramp_alpha_suffix: {
    // fieldName: 'ramp_alpha_suffix',
    // type: gdal.OFTString,
    // },
    // ramp_orig_dot_id: {
    // fieldName: 'ramp_orig_dot_id',
    // type: gdal.OFTString,
    // },
    // ramp_orig_co_order: {
    // fieldName: 'ramp_orig_co_order',
    // type: gdal.OFTInteger,
    // },
    // ramp_orig_mp: {
    // fieldName: 'ramp_orig_mp',
    // type: gdal.OFTReal,
    // },
    // ramp_dest_dot_id: {
    // fieldName: 'ramp_dest_dot_id',
    // type: gdal.OFTString,
    // },
    // ramp_dest_co_order: {
    // fieldName: 'ramp_dest_co_order',
    // type: gdal.OFTInteger,
    // },
    // ramp_dest_mp: {
    // fieldName: 'ramp_dest_mp',
    // type: gdal.OFTReal,
    // },
    // segment_type: {
    // fieldName: 'segment_type',
    // type: gdal.OFTString,
    // },
    // k_factor: {
    // fieldName: 'k_factor',
    // type: gdal.OFTReal,
    // },
    // d_factor: {
    // fieldName: 'd_factor',
    // type: gdal.OFTReal,
    // },
    // percent_peak_single_unit: {
    // fieldName: 'percent_peak_single_unit',
    // type: gdal.OFTReal,
    // },
    // percent_peak_combp: {
    // fieldName: 'percent_peak_combp',
    // type: gdal.OFTReal,
    // },
    // aadt_single_unit: {
    // fieldName: 'aadt_single_unit',
    // type: gdal.OFTInteger,
    // },
    // aadt_combo: {
    // fieldName: 'aadt_combo',
    // type: gdal.OFTInteger,
    // },
    // pavement_layer: {
    // fieldName: 'pavement_layer',
    // type: gdal.OFTInteger,
    // },
    // shape_length: {
    // fieldName: 'shape_length',
    // type: gdal.OFTReal,
    // },
  };

  _.forEach(propDefs, ({ fieldName, type }) =>
    addFieldToLayer(layer, fieldName, type),
  );

  const iter = targetMapDao.makeRawEdgeFeaturesIterator();

  for (const feature of iter) {
    const gdalFeature = new gdal.Feature(layer);

    // @ts-ignore
    Object.keys(feature.properties).forEach((prop) => {
      if (!propDefs[prop]) {
        return;
      }

      const { fieldName } = propDefs[prop];

      // @ts-ignore
      const v = feature.properties[prop];

      gdalFeature.fields.set(fieldName, _.isNil(v) ? null : JSON.stringify(v));
    });

    const multiLS = new gdal.MultiLineString();

    let geoms = turf.getCoords(feature);

    if (!Array.isArray(geoms[0][0])) {
      geoms = [geoms];
    }

    for (let i = 0; i < geoms.length; ++i) {
      const geom = geoms[i];

      const lineString = new gdal.LineString();

      for (let j = 0; j < geom.length; ++j) {
        const [lon, lat] = geom[j];

        lineString.points.add(new gdal.Point(lon, lat));
      }

      multiLS.children.add(lineString);
    }

    gdalFeature.setGeometry(multiLS);

    layer.features.add(gdalFeature);
  }
};

const addShstMatchesLayer = (dataset: gdal.Dataset) => {
  // @ts-ignore
  const layer = dataset.layers.create(`shst_matches`, wgs84, gdal.LineString);

  const fieldDefinitionPairs = [
    ['match_id', gdal.OFTInteger],
    ['shst_ref', gdal.OFTString],
    ['fid', gdal.OFTInteger],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  const iter = targetMapDao.makeAllShstMatchesIterator();

  for (const shstMatch of iter) {
    const gdalFeature = new gdal.Feature(layer);

    gdalFeature.fields.set('match_id', shstMatch.id);
    gdalFeature.fields.set('shst_ref', shstMatch.properties?.shstReferenceId);
    gdalFeature.fields.set('fid', shstMatch.properties?.pp_targetMapId);

    const lineString = new gdal.LineString();

    turf
      .getCoords(shstMatch)
      .forEach(([lon, lat]) => lineString.points.add(new gdal.Point(lon, lat)));

    gdalFeature.setGeometry(lineString);

    layer.features.add(gdalFeature);
  }
};

const addChosenShstMatchesLayer = (dataset: gdal.Dataset) => {
  // @ts-ignore
  const layer = dataset.layers.create(
    `shst_chosen_matches`,
    wgs84,
    gdal.LineString,
  );

  const fieldDefinitionPairs = [
    ['match_id', gdal.OFTInteger],
    ['shst_ref', gdal.OFTString],
    ['fid', gdal.OFTInteger],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  const iter = targetMapDao.makeTargetMapEdgesChosenMatchesIterator();

  for (const { chosenMatchesFeatureCollection } of iter) {
    const shstMatches = chosenMatchesFeatureCollection?.features;

    if (!_.isEmpty(shstMatches)) {
      shstMatches.forEach((shstMatch) => {
        const gdalFeature = new gdal.Feature(layer);

        gdalFeature.fields.set('match_id', shstMatch.id);
        gdalFeature.fields.set(
          'shst_ref',
          shstMatch.properties?.shstReferenceId,
        );
        gdalFeature.fields.set('fid', shstMatch.properties?.pp_targetMapId);

        const lineString = new gdal.LineString();

        turf
          .getCoords(shstMatch)
          .forEach(([lon, lat]) =>
            lineString.points.add(new gdal.Point(lon, lat)),
          );

        gdalFeature.setGeometry(lineString);

        layer.features.add(gdalFeature);
      });
    }
  }
};

export default function outputShapefile({
  output_directory,
  clean = false,
}: {
  output_directory: string;
  clean?: boolean;
}) {
  if (!output_directory) {
    console.error('The output_file parameter is required');
    process.exit(1);
  }

  if (existsSync(output_directory) && clean) {
    rimrafSync(output_directory);
  }

  const dataset = gdal.open(output_directory, 'w', 'ESRI Shapefile');

  addRawNysRisLayer(dataset);
  addShstMatchesLayer(dataset);
  addChosenShstMatchesLayer(dataset);

  dataset.close();
}
