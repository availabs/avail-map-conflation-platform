import memoizeOne from 'memoize-one';

import { SharedStreetsReference } from 'sharedstreets-types';
import { Database } from 'better-sqlite3';

import logger from '../../../../services/Logger';

import getModuleId from '../../../../utils/getModuleId';

// For logging.
const moduleId = getModuleId(__filename);

const getOldShstReferenceStmt = memoizeOne((db: Database) =>
  db.prepare(
    `
        SELECT
            a.id AS id,
            Max(a.geometry_id) as geometryId,
            Max(a.form_of_way) AS formOfWay,
            json_group_array(
              DISTINCT a.form_of_way
            ) as formOfWays,
            json_group_array(
              json_object(
                -- To restore original order.
                'locationReferenceIdx',
                location_reference_idx,

                'locationReference',
                json_object(
                  'intersectionId',
                  b.intersection_id,
                  'inboundBearing',
                  b.inbound_bearing,
                  'outboundBearing',
                  b.outbound_bearing,
                  'distanceToNextRef',
                  b.distance_to_next_ref
                )
              )
            ) AS locationReferences
          FROM shst.shst_references AS a
            INNER JOIN shst.shst_references_location_references AS b
              ON (a.id = b.shst_reference_id)
          WHERE ( id = ? )
          GROUP BY a.id ;
      `,
  ),
);

export const handleSharedStreetsReferenceInsertFailure = (
  db: Database,
  shstReference: SharedStreetsReference,
) => {
  const { id } = shstReference;

  const oldShstReference = getOldShstReferenceStmt(db).get([id]);

  if (oldShstReference !== null) {
    // Failed because of PRIMARY KEY CONFLICT
    const parsedOldLocationReferences = JSON.parse(
      oldShstReference.locationReferences,
    )
      .sort(
        ({ locationReferenceIdx: aIdx }, { locationReferenceIdx: bIdx }) =>
          aIdx - bIdx,
      )
      .map(({ locationReference }) => locationReference);

    oldShstReference.locationReferences = parsedOldLocationReferences;
  }

  const error =
    oldShstReference === null
      ? new Error('Unique SharedStreetsReference INSERT failed.')
      : new Error('Nonunique SharedStreetsReference ID');

  logger.warn({
    type: 'DATABASE_INSERT_FAILURE',
    error: true,
    payload: error,
    metadata: {
      conflict: { old: oldShstReference, new: shstReference },
      _moduleId: moduleId,
    },
  });
};

export const handleSharedStreetsLocationReferenceToGeoJsonFailure = (
  shstReference: SharedStreetsReference,
  locationReferenceIdx: number,
  error: Error,
) => {
  logger.warn({
    type: 'GEOJSON_CREATION_ERROR',
    error: true,
    payload: error,
    metadata: {
      msg: `Unable to create GeoJSON Point for SharedStreets LocationReference.`,
      shstReference,
      locationReferenceIdx,
      _moduleId: moduleId,
    },
  });
};

export const handleEmptyLocationReferences = (
  shstReference: SharedStreetsReference,
) => {
  logger.warn({
    type: 'SOURCE_DATA_INVARIANT_BROKEN',
    payload: {
      msg: `SharedStreetsReference has no LocationReferences.`,
      shstReference,
      _moduleId: moduleId,
    },
  });

  return false;
};

export const handleLocationReferenceIrregularBoundingPolygon = (
  shstReference: SharedStreetsReference,
  locationReferenceIdx: number,
) => {
  logger.warn({
    type: 'IRREGULAR_BOUNDING_POLYGON',
    payload: {
      msg: `SharedStreets LocationReference bounding polygon is MultiPolygon.`,
      shstReference,
      locationReferenceIdx,
      _moduleId: moduleId,
    },
  });

  return false;
};
