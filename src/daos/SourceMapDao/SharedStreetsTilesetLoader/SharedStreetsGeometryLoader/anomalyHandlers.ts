import { SharedStreetsGeometry } from 'sharedstreets-types';

import { Database } from 'better-sqlite3';

import getModuleId from '../../../../utils/getModuleId';

import logger from '../../../../services/Logger';

// For logging.
const moduleId = getModuleId(__filename);

export const handleSharedStreetsGeometryToGeoJsonFailure = (
  shstGeometry: SharedStreetsGeometry,
  error: Error,
) => {
  logger.warn({
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
  db: Database,
  shstGeometry: SharedStreetsGeometry,
) => {
  const { id } = shstGeometry;

  const oldShstGeometry =
    db
      .prepare(
        ` SELECT
            id,
            from_intersection_id,
            to_intersection_id,
            forward_reference_id,
            back_reference_id,
            road_class,
            geojson_linestring
          FROM shst.shst_geometries
          WHERE ( id = ? ) ;
      `,
      )
      .get([id]) || null;

  const error =
    oldShstGeometry === null
      ? new Error('Unique SharedStreetsGeometry INSERT failed.')
      : new Error('Nonunique SharedStreetsGeometry ID');

  logger.warn({
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
