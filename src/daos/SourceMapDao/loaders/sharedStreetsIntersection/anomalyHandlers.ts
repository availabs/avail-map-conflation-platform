import { SharedStreetsIntersection } from 'sharedstreets-types';

import getModuleId from '../../../../utils/getModuleId';

import logger from '../../../../services/Logger';

import SCHEMA from '../../DATABASE_SCHEMA_NAME';

// For logging.
const moduleId = getModuleId(__filename);

// import {
//   handleSharedStreetsIntersectionToGeoJsonFailure,
//   handleShstIntersectionInsertFailure,
//   handleSharedStreetsIntersectionIrregularBoundingPolygon,
//   handleShstIntersectionReferenceInsertFailure,
// } from './anomalyHandlers';

export const handleSharedStreetsIntersectionToGeoJsonFailure = (
  shstIntersection: SharedStreetsIntersection,
  error: Error,
) => {
  logger.error({
    type: 'GEOJSON_CREATION_ERROR',
    error: true,
    payload: error,
    metadata: {
      msg: `Unable to create GeoJSON Point for SharedStreetsIntersection.`,
      shstIntersection,
      _moduleId: moduleId,
    },
  });
};

// TODO TODO TODO
//   More sophisticated handling of shstIntersectionId conflicts should either
//     * choose optimal shstIntersection for the database, or
//     * merge shstIntersections
export const handleShstIntersectionInsertFailure = (
  db: any,
  shstIntersection: SharedStreetsIntersection,
) => {
  const { id } = shstIntersection;

  // Using the GeoJSON because it contains the inboundReferenceIds and outboundReferenceIds.
  const oldShstIntersectionGeoJson = JSON.parse(
    db
      .prepare(
        ` SELECT
            geojson_point
          FROM ${SCHEMA}.shst_geometries
          WHERE ( id = ? ) ;
      `,
      )
      .get([id])?.geojson_point || null,
  );

  const error =
    oldShstIntersectionGeoJson === null
      ? new Error('Unique SharedStreetsIntersection INSERT failed.')
      : new Error('Nonunique SharedStreetsIntersection ID');

  const oldShstIntersection: null | SharedStreetsIntersection = oldShstIntersectionGeoJson && {
    ...oldShstIntersectionGeoJson.properties,
  };

  logger.error({
    type: 'DATABASE_INSERT_FAILURE',
    error: true,
    payload: error,
    metadata: {
      conflict: { old: oldShstIntersection, new: shstIntersection },
      _moduleId: moduleId,
    },
  });
};

export const handleSharedStreetsIntersectionIrregularBoundingPolygon = (
  shstIntersection: SharedStreetsIntersection,
) => {
  logger.warn({
    type: 'IRREGULAR_BOUNDING_POLYGON',
    payload: {
      msg: `SharedStreetsIntersection bounding polygon is MultiPolygon.`,
      shstIntersection,
      _moduleId: moduleId,
    },
  });

  return false;
};

export const handleShstIntersectionReferenceInsertFailure = (
  shstIntersection: SharedStreetsIntersection,
  referenceType: 'inbound' | 'outbound',
  referenceIndex: number,
) => {
  const error = new Error(
    `Nonunique SharedStreetsIntersection ${referenceType}ReferenceId.`,
  );

  logger.error({
    type: 'DATABASE_INSERT_FAILURE',
    error: true,
    payload: error,
    metadata: {
      shstIntersection,
      referenceType,
      referenceIndex,
      _moduleId: moduleId,
    },
  });
};
