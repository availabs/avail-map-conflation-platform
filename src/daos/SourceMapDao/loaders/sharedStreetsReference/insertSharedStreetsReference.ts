import * as turf from '@turf/turf';
import _ from 'lodash';

import { SharedStreetsReference } from 'sharedstreets-types';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import {
  handleSharedStreetsReferenceInsertFailure,
  handleEmptyLocationReferences,
  handleSharedStreetsLocationReferenceToGeoJsonFailure,
  handleLocationReferenceIrregularBoundingPolygon,
} from './anomalyHandlers';

const updateLocationReferencesGeopolyIndex = (
  db: any,
  shstReference: SharedStreetsReference,
  locationReferenceIdx: number,
  locationReferencePoint: turf.Feature<turf.Point>,
) => {
  // Update the spatial index.
  if (locationReferencePoint !== null) {
    // Coordinates of the feature's bounding polygon.
    const polyCoords = getBufferPolygonCoords(locationReferencePoint);

    if (polyCoords.length !== 1) {
      handleLocationReferenceIrregularBoundingPolygon(
        shstReference,
        locationReferenceIdx,
      );
    }

    // If this INSERT fails, the database the DB is corrupted.
    //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
    db.prepare(
      `
        INSERT INTO ${SCHEMA}.shst_references_location_references_geopoly_idx (
          _shape,
          shst_reference_id,
          location_reference_idx
        ) VALUES (?, ?, ?) ; `,
    ).run([
      JSON.stringify(_.first(polyCoords)),
      shstReference.id,
      locationReferenceIdx,
    ]);
  }
};

// export interface LocationReference {
//   intersectionId: string;
//   lon: number;
//   lat: number;
//   inboundBearing?: number;
//   outboundBearing?: number;
//   distanceToNextRef?: number;
// }
const insertLocationReferences = (
  db: any,
  shstReference: SharedStreetsReference,
) => {
  const { id: shstReferenceId, locationReferences } = shstReference;

  if (_.isEmpty(locationReferences)) {
    handleEmptyLocationReferences(shstReference);
    return false;
  }

  for (
    let locationReferenceIdx = 0;
    locationReferenceIdx < locationReferences.length;
    ++locationReferenceIdx
  ) {
    const locationReference = locationReferences[locationReferenceIdx];

    const {
      intersectionId,
      lon,
      lat,
      inboundBearing,
      outboundBearing,
      distanceToNextRef,
    } = locationReference;

    let locationReferencePoint: turf.Feature<turf.Point> | null;

    try {
      locationReferencePoint = turf.point(
        [lon, lat],
        {},
        { id: `${shstReferenceId}|${locationReferenceIdx}` },
      );

      if (_.isEmpty(locationReferencePoint?.geometry?.coordinates)) {
        throw new Error(
          'Empty SharedStreets LocationReference GeoJSON Point coordinates.',
        );
      }
    } catch (error) {
      handleSharedStreetsLocationReferenceToGeoJsonFailure(
        shstReference,
        locationReferenceIdx,
        error,
      );
      // Keep processing. Non-critical error.
      locationReferencePoint = null;
    }

    // If this INSERT fails, the database is corrupted.
    //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
    db.prepare(
      `
        INSERT INTO ${SCHEMA}.shst_references_location_references (
          shst_reference_id,
          location_reference_idx,
          intersection_id,
          inbound_bearing,
          outbound_bearing,
          distance_to_next_ref,
          geojson_point
        ) VALUES (?, ?, ?, ?, ?, ?, ?) ;
    `,
    ).run([
      shstReferenceId,
      locationReferenceIdx,
      intersectionId,
      inboundBearing,
      outboundBearing,
      distanceToNextRef,
      locationReferencePoint && JSON.stringify(locationReferencePoint),
    ]);

    if (locationReferencePoint !== null) {
      updateLocationReferencesGeopolyIndex(
        db,
        shstReference,
        locationReferenceIdx,
        locationReferencePoint,
      );
    }
  }

  return true;
};

// export interface SharedStreetsReference {
//   id: string;
//   geometryId: string;
//   formOfWay: number;
//   locationReferences: LocationReference[];
// }
const loadSharedStreetsReference = (
  db: any,
  shstReference: SharedStreetsReference,
) => {
  const { id, geometryId, formOfWay } = shstReference;

  // If the id exists in the database, changes === 0.
  //   Otherwise, changes === 1.
  const { changes: success } = db
    .prepare(
      `
        INSERT OR IGNORE INTO ${SCHEMA}.shst_references (
          id,
          geometry_id,
          form_of_way
        ) VALUES (?, ?, ?)
      ; `,
    )
    .run([id, geometryId, formOfWay]);

  if (!success) {
    handleSharedStreetsReferenceInsertFailure(db, shstReference);
    return false;
  }

  return insertLocationReferences(db, shstReference);
};

export default loadSharedStreetsReference;
