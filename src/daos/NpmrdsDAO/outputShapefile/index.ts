/* eslint-disable no-restricted-syntax */

import { existsSync } from 'fs';

import * as turf from '@turf/turf';

import gdal from 'gdal';

import { sync as rimrafSync } from 'rimraf';

import _ from 'lodash';

import { NPMRDS as SCHEMA } from '../../../constants/databaseSchemaNames';

import TargetMapDAO from '../../../utils/TargetMapDatabases/TargetMapDAO';

import { NpmrdsTmcFeature } from '../raw_map_layer/domain/types';

// @ts-ignore
const wgs84 = gdal.SpatialReference.fromEPSG(4326);

type gdalOFTType = string;

type NpmrdsTargetMapDao = TargetMapDAO<NpmrdsTmcFeature>;

const addFieldToLayer = (layer: gdal.Layer, name: string, type: gdalOFTType) =>
  layer.fields.add(new gdal.FieldDefn(name, type));

const addRawNpmrdsLayer = (
  targetMapDao: NpmrdsTargetMapDao,
  dataset: gdal.Dataset,
) => {
  // @ts-ignore
  const layer = dataset.layers.create(
    `raw_npmrds`,
    wgs84,
    gdal.MultiLineString,
  );

  const propDefs = {
    tmc: {
      fieldName: 'tmc',
      type: gdal.OFTString,
    },
    type: {
      fieldName: 'type',
      type: gdal.OFTString,
    },
    road: {
      fieldName: 'road',
      type: gdal.OFTString,
    },
    road_order: {
      fieldName: 'road_order',
      type: gdal.OFTInteger,
    },
    intersection: {
      fieldName: 'intxn',
      type: gdal.OFTString,
    },
    tmclinear: {
      fieldName: 'tmclinear',
      type: gdal.OFTInteger,
    },
    lineartmc: {
      fieldName: 'lineartmc',
      type: gdal.OFTString,
    },
    country: {
      fieldName: 'country',
      type: gdal.OFTString,
    },
    state: {
      fieldName: 'state',
      type: gdal.OFTString,
    },
    county: {
      fieldName: 'county',
      type: gdal.OFTString,
    },
    zip: {
      fieldName: 'zip',
      type: gdal.OFTString,
    },
    direction: {
      fieldName: 'direction',
      type: gdal.OFTString,
    },
    start_latitude: {
      fieldName: 'startlat',
      type: gdal.OFTReal,
    },
    start_longitude: {
      fieldName: 'startlon',
      type: gdal.OFTReal,
    },
    end_latitude: {
      fieldName: 'endlat',
      type: gdal.OFTReal,
    },
    end_longitude: {
      fieldName: 'endlong',
      type: gdal.OFTReal,
    },
    miles: {
      fieldName: 'miles',
      type: gdal.OFTReal,
    },
    frc: {
      fieldName: 'frc',
      type: gdal.OFTInteger,
    },
    border_set: {
      fieldName: 'border_set',
      type: gdal.OFTString,
    },
    isprimary: {
      fieldName: 'isprimary',
      type: gdal.OFTInteger,
    },
    f_system: {
      fieldName: 'f_system',
      type: gdal.OFTInteger,
    },
    urban_code: {
      fieldName: 'urban_code',
      type: gdal.OFTInteger,
    },
    faciltype: {
      fieldName: 'faciltype',
      type: gdal.OFTInteger,
    },
    structype: {
      fieldName: 'structype',
      type: gdal.OFTInteger,
    },
    thrulanes: {
      fieldName: 'thrulanes',
      type: gdal.OFTInteger,
    },
    route_numb: {
      fieldName: 'route_numb',
      type: gdal.OFTInteger,
    },
    route_sign: {
      fieldName: 'route_sign',
      type: gdal.OFTInteger,
    },
    route_qual: {
      fieldName: 'route_qual',
      type: gdal.OFTInteger,
    },
    altrtename: {
      fieldName: 'altrtename',
      type: gdal.OFTString,
    },
    aadt: {
      fieldName: 'aadt',
      type: gdal.OFTInteger,
    },
    aadt_singl: {
      fieldName: 'aadt_singl',
      type: gdal.OFTInteger,
    },
    aadt_combi: {
      fieldName: 'aadt_combi',
      type: gdal.OFTInteger,
    },
    nhs: {
      fieldName: 'nhs',
      type: gdal.OFTInteger,
    },
    nhs_pct: {
      fieldName: 'nhs_pct',
      type: gdal.OFTInteger,
    },
    strhnt_typ: {
      fieldName: 'strhnt_typ',
      type: gdal.OFTInteger,
    },
    strhnt_pct: {
      fieldName: 'strhnt_pct',
      type: gdal.OFTInteger,
    },
    truck: {
      fieldName: 'truck',
      type: gdal.OFTInteger,
    },
    timezone_name: {
      fieldName: 'timezone',
      type: gdal.OFTString,
    },
    active_start_date: {
      fieldName: 'start_date',
      type: gdal.OFTDate,
    },
    active_end_date: {
      fieldName: 'end_date',
      type: gdal.OFTDate,
    },
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

const addShstMatchesLayer = (
  targetMapDao: NpmrdsTargetMapDao,
  dataset: gdal.Dataset,
) => {
  // @ts-ignore
  const layer = dataset.layers.create(`shst_matches`, wgs84, gdal.LineString);

  const fieldDefinitionPairs = [
    ['match_id', gdal.OFTInteger],
    ['shst_ref', gdal.OFTString],
    ['tmc', gdal.OFTString],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  const iter = targetMapDao.makeAllShstMatchesIterator();

  for (const shstMatch of iter) {
    const gdalFeature = new gdal.Feature(layer);

    gdalFeature.fields.set('match_id', shstMatch.id);
    gdalFeature.fields.set('shst_ref', shstMatch.properties?.shstReferenceId);
    gdalFeature.fields.set('tmc', shstMatch.properties?.pp_targetMapId);

    const lineString = new gdal.LineString();

    turf
      .getCoords(shstMatch)
      .forEach(([lon, lat]) => lineString.points.add(new gdal.Point(lon, lat)));

    gdalFeature.setGeometry(lineString);

    layer.features.add(gdalFeature);
  }
};

// const addChosenShstMatchesLayer = (dataset) => {
// const layer = dataset.layers.create(
// `chosen_shst_matches`,
// wgs84,
// gdal.LineString,
// );

// const fieldDefinitionPairs = [
// ['id', gdal.OFTInteger],
// ['shst_ref', gdal.OFTString],
// ['shape_id', gdal.OFTString],
// ['shape_idx', gdal.OFTInteger],
// ];

// const definedFields = fieldDefinitionPairs.map(([field]) => field);

// for (const [name, type] of fieldDefinitionPairs) {
// addFieldToLayer(layer, name, type);
// }

// const iter = GtfsOsmNetworkDAO.makeAllChosenShstMatchesIterator();

// for (const shstMatch of iter) {
// const gdalFeature = new gdal.Feature(layer);

// Object.keys(shstMatch.properties).forEach((prop) => {
// const fieldName = prop
// .replace(/^shstReferenceId$/, 'shst_ref')
// .replace(/^pp_shape_id$/, 'shape_id')
// .replace(/^pp_shape_index$/, 'shape_idx');

// if (definedFields.includes(fieldName)) {
// let v = shstMatch.properties[prop];

// if (_.isNil(v)) {
// v = null;
// } else if (typeof v !== 'string') {
// v = JSON.stringify(v);
// }

// gdalFeature.fields.set(fieldName, v);
// }
// });

// const lineString = new gdal.LineString();

// turf
// .getCoords(shstMatch)
// .forEach(([lon, lat]) => lineString.points.add(new gdal.Point(lon, lat)));

// gdalFeature.setGeometry(lineString);

// layer.features.add(gdalFeature);
// }
// };

export default function outputShapefile({
  output_directory,
  clean = false,
}: {
  output_directory: string;
  clean?: boolean;
}) {
  const targetMapDao: NpmrdsTargetMapDao = new TargetMapDAO(SCHEMA);

  if (!output_directory) {
    console.error('The output_file parameter is required');
    process.exit(1);
  }

  if (existsSync(output_directory) && clean) {
    rimrafSync(output_directory);
  }

  const dataset = gdal.open(output_directory, 'w', 'ESRI Shapefile');

  addRawNpmrdsLayer(targetMapDao, dataset);
  addShstMatchesLayer(targetMapDao, dataset);

  dataset.close();
}
