/* eslint-disable no-param-reassign */

import _ from 'lodash';
import * as turf from '@turf/turf';

// import getShapeDistancesTraveledUnits from './getShapeDistancesTraveledUnits';
// import getShapeAnalysis from './getShapeAnalysis';

// NOTE: This function is used as a SQLite user-defined function.
export default function createShapeLineString(
  shapeId: string,
  shapeDataStr: string,
) {
  const sortedShapeData: {
    coordinate: [number, number];
    shape_dist_traveled: number;
    shape_pt_sequence: number;
  }[] = _.sortBy(JSON.parse(shapeDataStr), 'shape_pt_sequence');

  const filteredShapeData = sortedShapeData
    .map(({ shape_dist_traveled, coordinate: [lon, lat] }) => ({
      shape_dist_traveled,
      coordinate: [_.round(lon, 6), _.round(lat, 6)],
    }))
    .filter(
      ({ coordinate }, i, arr) =>
        !_.isEqual(coordinate, arr[i - 1]?.coordinate),
    );

  const coordinates = filteredShapeData.map(({ coordinate }) => coordinate);

  // NOTE: properties overwritten below
  const shape = turf.lineString(coordinates, {}, { id: shapeId });

  let shapeDistancesTraveled:
    | number[]
    | null = filteredShapeData.map(({ shape_dist_traveled }) =>
    _.round(shape_dist_traveled, 6),
  );

  if (!shapeDistancesTraveled.some(Boolean)) {
    shapeDistancesTraveled = null;
  } else {
    // In GTFS, 1st could be NULL
    shapeDistancesTraveled[0] = 0;
  }

  // const shapeDistancesTraveledUnits =
  // shapeDistancesTraveled &&
  // getShapeDistancesTraveledUnits(shape, shapeDistancesTraveled);

  // const shapeAnalysis = getShapeAnalysis.call(this, shape);

  shape.properties = {
    shapeId,
    // shapeDistancesTraveled,
    // shapeDistancesTraveledUnits,
    // ...shapeAnalysis,
  };

  this?.shapesWriter?.write(shape, [
    'shapeDistancesTraveled',
    'computedShapeDistancesTraveledKm',
    'selfIntxnCoords',
  ]);

  return shape;
}
