import * as turf from '@turf/turf';
import _ from 'lodash';

import memoizeOne from 'memoize-one';

import { SharedStreetsIntersection } from 'sharedstreets-types';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import {
  handleSharedStreetsIntersectionToGeoJsonFailure,
  handleShstIntersectionInsertFailure,
  handleSharedStreetsIntersectionIrregularBoundingPolygon,
  handleShstIntersectionReferenceInsertFailure,
} from './anomalyHandlers';

const updateSpatialIndex = (
  db: any,
  shstIntersection: SharedStreetsIntersection,
  shstIntersectionPoint: turf.Feature<turf.Point>,
) => {
  // Coordinates of the feature's bounding polygon.
  const polyCoords = getBufferPolygonCoords(shstIntersectionPoint);

  if (polyCoords.length !== 1) {
    handleSharedStreetsIntersectionIrregularBoundingPolygon(shstIntersection);
  }

  // Inserts only the first set of coordinates.
  // If this INSERT fails, the database is corrupted.
  //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
  db.prepare(
    `
      INSERT INTO ${SCHEMA}.shst_intersections_geopoly_idx (
        _shape,
        id
      ) VALUES (?, ?) ;
    `,
  ).run([JSON.stringify(_.first(polyCoords)), shstIntersection.id]);
};

const createShstIntersectionPoint = memoizeOne(
  (shstIntersection: SharedStreetsIntersection) => {
    const {
      id: shstIntersectionId,
      nodeId,
      lon,
      lat,
      inboundReferenceIds,
      outboundReferenceIds,
    } = shstIntersection;

    try {
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        return turf.point(
          [lon, lat],
          {
            id: shstIntersectionId,
            nodeId,
            inboundReferenceIds,
            outboundReferenceIds,
          },
          { id: shstIntersectionId },
        );
      }

      throw new Error('Invalid (lon, lat) for SharedStreetsIntersection.');
    } catch (err) {
      handleSharedStreetsIntersectionToGeoJsonFailure(shstIntersection, err);
      return null;
    }
  },
);

const insertShstIntersection = (
  db: any,
  shstIntersection: SharedStreetsIntersection,
) => {
  const { id: shstIntersectionId, nodeId } = shstIntersection;
  const shstIntersectionPoint = createShstIntersectionPoint(shstIntersection);

  // If the shstIntersectionId exists in the database, changes === 0.
  //   Otherwise, changes === 1.
  const { changes: success } = db
    .prepare(
      `
        INSERT OR IGNORE INTO ${SCHEMA}.shst_intersections (
          id,
          node_id,
          geojson_point
        ) VALUES (?, ?, ?)
      ; `,
    )
    .run([
      shstIntersectionId,
      nodeId,
      shstIntersectionPoint && JSON.stringify(shstIntersectionPoint),
    ]);

  if (!success) {
    handleShstIntersectionInsertFailure(db, shstIntersection);
    return false;
  }

  if (shstIntersectionPoint !== null) {
    updateSpatialIndex(db, shstIntersection, shstIntersectionPoint);
  }

  return success;
};

const insertIntersectionReferenceIds = (
  referenceType: 'inbound' | 'outbound',
  db: any,
  shstIntersection: SharedStreetsIntersection,
) => {
  const { id: shstIntersectionId } = shstIntersection;

  const shstReferenceIds: string[] | null =
    shstIntersection[`${referenceType}ReferenceIds`];

  if (shstReferenceIds !== null) {
    for (
      let referenceIndex = 0;
      referenceIndex < shstReferenceIds.length;
      ++referenceIndex
    ) {
      const shstReferenceId = shstReferenceIds[referenceIndex];

      const { changes: success } = db
        .prepare(
          `
            INSERT OR IGNORE INTO ${SCHEMA}.shst_intersections_${referenceType}_references (
              shst_intersection_id,
              shst_reference_id
            ) VALUES (?, ?)
          ; `,
        )
        .run([shstIntersectionId, shstReferenceId]);

      if (!success) {
        handleShstIntersectionReferenceInsertFailure(
          shstIntersection,
          referenceType,
          referenceIndex,
        );
      }
    }
  }
};

const insertIntersectionInboundReferenceIds = insertIntersectionReferenceIds.bind(
  null,
  'inbound',
);
const insertIntersectionOutboundReferenceIds = insertIntersectionReferenceIds.bind(
  null,
  'outbound',
);

export default (db: any, shstIntersection: SharedStreetsIntersection) => {
  insertShstIntersection(db, shstIntersection);

  insertIntersectionInboundReferenceIds(db, shstIntersection);
  insertIntersectionOutboundReferenceIds(db, shstIntersection);

  return true;
};
