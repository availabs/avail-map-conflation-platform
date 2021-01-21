/* eslint-disable no-param-reassign */

import * as turf from '@turf/turf';
import _ from 'lodash';

const segmentizeShapeLineString = (shapeLineString) =>
  turf.segmentReduce(
    shapeLineString,
    (acc, segment, _0, _1, _2, segment_idx) => {
      const prevSeg = _.last(acc);

      const {
        properties: {
          start_dist_along: prevSegDistAlong = 0,
          length_km: prevSegLength = 0,
        } = {},
      } = prevSeg || {};

      acc.push({
        ...segment,
        properties: {
          segment_idx,
          length_km: turf.length(segment),
          start_dist_along: prevSegDistAlong + prevSegLength,
        },
      });
      return acc;
    },
    [],
  );

// O(S*Ps) where S is the number of stopPoints, and Ps is the number of path segments.
function getStopsProjectedToPathSegmentsTable(stopPoints, shapeSegments) {
  // Each stop point, mapped to each path segment
  return stopPoints.map((stopPt) => {
    // For each stopPt, snap it to each path segment.
    return shapeSegments.map((segment, i) => {
      const snapped = turf.pointOnLine(segment, stopPt);
      const snappedCoords = snapped.geometry.coordinates;

      const [segmentStartCoord] = turf.getCoords(segment);
      const segmentStartPt = turf.point(segmentStartCoord);

      const snappedDistTraveled =
        turf.distance(segmentStartPt, snapped) +
        segment.properties.start_dist_along;

      const deviationKm = turf.distance(stopPt, snapped);

      return {
        segmentNum: i,
        pointCoords: stopPt.geometry.coordinates,
        snappedCoords,
        snappedDistAlongKm: snappedDistTraveled,
        deviationKm,
      };
    });
  });
}

// O(S W lg W) where S is the number of stops, W is the number of waypointCoords in the path.
// Additional O(SW) space cost, as the table is replicated.
function trySimpleMinification(theTable) {
  const possibleOptimal = theTable.map((row) =>
    _(row).sortBy(['deviationKm', 'snappedDistAlongKm']).first(),
  );

  // If
  function invariantCheck(projectedPointA, projectedPointB) {
    return (
      projectedPointA.snappedDistAlongKm <= projectedPointB.snappedDistAlongKm
    );
  }

  return _.tail(possibleOptimal).every((currPossOpt, i) =>
    invariantCheck(possibleOptimal[i], currPossOpt),
  )
    ? possibleOptimal
    : null;
}

// Finds the stops-to-path fitting with the minimum
//      total squared distance between stops and their projection onto path line segments
//      while maintaining the strong no-backtracking constraint.
//
// O(SW^2) where S is the number of stops, W is the number of waypointCoords in the path.
//
// NOTE: O(S W lg^2 W) is possible by using Willard's range trees on each row to find the optimal
//       cell from the previous row from which to advance.
//
// INTUITION: Can use spatial datastructures to speed this up? rbush? Trimming the shape?
//            This feels completely brute force.
function fitStopsToPathUsingLeastSquares(theTable) {
  const [headRow] = theTable;
  const tailRows = theTable.slice(1);

  // Initialize the first row.
  headRow.forEach((cell) => {
    cell.cost = cell.deviationKm * cell.deviationKm;
    cell.path = [cell.segmentNum];
  });

  // Do dynamic programing...
  //   Looking for the lowest cost path from the first row
  tailRows.forEach((tableRow, i) => {
    tableRow.forEach((thisCell) => {
      // thisCell is the geospatial snapping of the stop to the shape segment.

      let bestFromPreviousRow = {
        cost: Number.POSITIVE_INFINITY,
      };

      theTable[i].forEach((fromCell) => {
        // INTUITION: It seems like the no backtracking constraint can be used to
        //            reduce the search space until it is almost linear.
        if (
          fromCell.snappedDistAlongKm <= thisCell.snappedDistAlongKm &&
          fromCell.cost < bestFromPreviousRow.cost
        ) {
          bestFromPreviousRow = fromCell;
        }
      });

      // Add this best
      thisCell.cost =
        bestFromPreviousRow.cost + thisCell.deviationKm * thisCell.deviationKm;

      if (thisCell.cost < Number.POSITIVE_INFINITY) {
        thisCell.path = bestFromPreviousRow.path.slice(); // This can be done once.
        thisCell.path.push(thisCell.segmentNum);
      } else {
        thisCell.path = null;
      }
    });
  });

  // Did we find a path that works satisfies the constraint???

  // The last row represents the cost to get from the origin to the destination.
  //   The cost is
  //      * INFINITY if the no-backtracking constraint is violated.
  //      * the sum of the squares of the distance between the stop's coords
  //        and the snapped point coords, otherwise.
  //   If the constraint failed for EVERY possible path, the min cost path is null.
  const bestAssignmentOfSegments = _.minBy(_.last(theTable), 'cost').path;

  if (bestAssignmentOfSegments) {
    return bestAssignmentOfSegments.map((segmentNum, stopIndex) => {
      const bestProjection = theTable[stopIndex][segmentNum];

      return {
        segmentNum,
        pointCoords: bestProjection.pointCoords,
        snappedCoords: bestProjection.snappedCoords,
        snappedDistAlongKm: bestProjection.snappedDistAlongKm,
        deviationKm: bestProjection.deviationKm,
      };
    });
  }

  return null;
}

export default function fitStopsToPath(shapeLineString, stopPointsSeq) {
  const shapeSegments = segmentizeShapeLineString(shapeLineString);

  // first build the table
  const theTable = getStopsProjectedToPathSegmentsTable(
    stopPointsSeq,
    shapeSegments,
  );

  // try the simple case
  let stopProjections = trySimpleMinification(theTable);

  if (!stopProjections) {
    // Simple case failed, use least squares dynamic programming.
    stopProjections = fitStopsToPathUsingLeastSquares(theTable);
  }

  return Array.isArray(stopProjections) && stopProjections.length
    ? stopProjections
    : null;
}
