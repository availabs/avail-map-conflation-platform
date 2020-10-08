import * as turf from '@turf/turf';
import _ from 'lodash';

import { SharedStreetsGeometry } from 'sharedstreets-types';

import getModuleId from '../../../../utils/getModuleId';

import logger from '../../../../services/Logger';

import SCHEMA from '../../DATABASE_SCHEMA_NAME';

// For logging.
const moduleId = getModuleId(__filename);

export const handleSharedStreetsGeometryToGeoJsonFailure = (
  shstGeometry: SharedStreetsGeometry,
  error: Error,
) => {
  logger.error({
    type: 'GEOJSON_CREATION_ERROR',
    error: true,
    payload: error,
    metadata: {
      msg: `Unable to create GeoJSON LineString for SharedStreetsGeometry.`,
      shstGeometry,
      _moduleId: moduleId,
    },
  });
};

// TODO TODO TODO
//   More sophisticated handling of shstGeometryId conflicts should either
//     * choose optimal shstGeometry for the database, or
//     * merge shstGeometries
export const handleShstGeometryInsertFailure = (
  db: any,
  shstGeometry: SharedStreetsGeometry,
) => {
  const { id } = shstGeometry;

  const oldShstGeometryGeoJson = JSON.parse(
    db
      .prepare(
        ` SELECT
            geojson_linestring
          FROM ${SCHEMA}.shst_geometries
          WHERE ( id = ? ) ;
      `,
      )
      .get([id])?.geojson_linestring || null,
  );

  const error =
    oldShstGeometryGeoJson === null
      ? new Error('Unique SharedStreetsGeometry INSERT failed.')
      : new Error('Nonunique SharedStreetsGeometry ID');

  const oldShstGeometry: null | SharedStreetsGeometry = oldShstGeometryGeoJson && {
    ...oldShstGeometryGeoJson.properties,
    lonlats: _.flatten(turf.getCoords(oldShstGeometryGeoJson)),
  };

  logger.error({
    type: 'DATABASE_INSERT_FAILURE',
    error: true,
    payload: error,
    metadata: {
      conflict: { old: oldShstGeometry, new: shstGeometry },
      _moduleId: moduleId,
    },
  });
};

export const handleSharedStreetsGeometryIrregularBoundingPolygon = (
  shstGeometry: SharedStreetsGeometry,
) => {
  logger.warn({
    type: 'IRREGULAR_BOUNDING_POLYGON',
    payload: {
      msg: `SharedStreetsGeometry bounding polygon is MultiPolygon.`,
      shstGeometry,
      _moduleId: moduleId,
    },
  });

  return false;
};
