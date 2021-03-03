import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { SharedStreetsGeometry } from 'sharedstreets-types';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import {
  handleSharedStreetsGeometryToGeoJsonFailure,
  handleShstGeometryInsertFailure,
  handleSharedStreetsGeometryIrregularBoundingPolygon,
} from './anomalyHandlers';

export default (db: any, shstGeometry: SharedStreetsGeometry) => {
  const {
    id: shstGeometryId,
    fromIntersectionId = null,
    toIntersectionId = null,
    roadClass,
    lonlats,
  } = shstGeometry;

  let { forwardReferenceId, backReferenceId } = shstGeometry;

  forwardReferenceId = forwardReferenceId ?? null;
  backReferenceId = backReferenceId ?? null;

  const shstGeometryCoords = _.chunk(lonlats, 2);

  let shstGeometryLineString: turf.Feature<turf.LineString> | null;

  try {
    shstGeometryLineString = turf.lineString(
      shstGeometryCoords,
      {
        id: shstGeometryId,
        // fromIntersectionId,
        // toIntersectionId,
        // forwardReferenceId,
        // backReferenceId,
        // roadClass,
      },
      { id: shstGeometryId },
    );

    if (_.isEmpty(shstGeometryLineString?.geometry?.coordinates)) {
      throw new Error(
        'Empty SharedStreetsGeometry GeoJSON LineString coordinates.',
      );
    }
  } catch (err) {
    shstGeometryLineString = null;
    handleSharedStreetsGeometryToGeoJsonFailure(shstGeometry, err);
  }

  // If the shstGeometryId exists in the database, changes === 0.
  //   Otherwise, changes === 1.
  const { changes: success } = db
    .prepare(
      `
        INSERT OR IGNORE INTO ${SCHEMA}.shst_geometries (
          id,
          from_intersection_id,
          to_intersection_id,
          forward_reference_id,
          back_reference_id,
          road_class,
          geojson_linestring
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ; `,
    )
    .run([
      shstGeometryId,
      fromIntersectionId,
      toIntersectionId,
      forwardReferenceId || null,
      backReferenceId || null,
      roadClass,
      shstGeometryLineString && JSON.stringify(shstGeometryLineString),
    ]);

  if (!success) {
    handleShstGeometryInsertFailure(db, shstGeometry);
    return false;
  }

  if (shstGeometryLineString !== null) {
    // Coordinates of the feature's bounding polygon.
    const polyCoords = getBufferPolygonCoords(shstGeometryLineString);

    if (polyCoords.length !== 1) {
      handleSharedStreetsGeometryIrregularBoundingPolygon(shstGeometry);
    }

    const geopolyShape = _.first(polyCoords);

    assert(
      Array.isArray(geopolyShape) &&
        geopolyShape.every(
          (coords) => Array.isArray(coords) && coords.length === 2,
        ) &&
        _.isEqual(geopolyShape[0], geopolyShape[geopolyShape.length - 1]),
    );

    // Inserts only the first set of coordinates.
    // If this INSERT fails, the database is corrupted.
    //   Therefore, we want the Error to propagate up and cause a TRANSACTION ROLLBACK.
    db.prepare(
      `
        INSERT INTO ${SCHEMA}.shst_geometries_geopoly_idx (
          _shape,
          id
        ) VALUES (?, ?) ;
      `,
    ).run([JSON.stringify(_.first(polyCoords)), shstGeometryId]);
  }

  return true;
};
