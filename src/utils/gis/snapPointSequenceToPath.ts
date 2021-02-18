/* eslint-disable no-param-reassign */

import * as turf from '@turf/turf';
import _ from 'lodash';

type LineStringSegment = turf.Feature<turf.LineString> & {
  properties: {
    segment_idx: number;
    length_km: number;
    start_dist_along: number;
  };
};

export type TargetMapPointToSourceLineSegmentSnapStats = {
  segmentNum: number;
  pointCoords: turf.Position | null;
  snappedCoords: turf.Position | null;
  snappedDistAlongKm: number | null;
  deviationKm: number;
};

export type OptimalTargetMapPointToSourceLineSegmentSnapStat = TargetMapPointToSourceLineSegmentSnapStats & {
  pointCoords: turf.Position;
  snappedCoords: turf.Position;
  snappedDistAlongKm: number;
};

export type OptimalTargetMapPointToSourceLineSegmentSnaps = OptimalTargetMapPointToSourceLineSegmentSnapStat[];

type TargetMapPointToSourceLineSegmentSnapStatsTable = Array<
  TargetMapPointToSourceLineSegmentSnapStats
>[];

function segmentSourceLineString(
  sourceLineString: turf.Feature<turf.LineString>,
): LineStringSegment[] {
  return turf.segmentReduce(
    sourceLineString,
    // @ts-ignore
    (
      acc: LineStringSegment[],
      segment: turf.Feature<turf.LineString>,
      _0,
      _1,
      _2,
      segment_idx,
    ) => {
      const prevSeg = _.last(acc);

      const {
        properties: {
          start_dist_along: prevSegDistAlong = 0,
          length_km: prevSegLength = 0,
        } = {},
      } = prevSeg || {};

      segment.properties = {
        segment_idx,
        length_km: turf.length(segment),
        start_dist_along: prevSegDistAlong + prevSegLength,
      };

      // @ts-ignore
      acc.push(segment);

      return acc;
    },
    [],
  );
}

// O(S*Ps) where S is the number of targetPoints, and Ps is the number of path segments.
function getTargetMapPointToSourceLineSegmentSnapStatsTable(
  targetPoints: turf.Feature<turf.Point>[],
  sourceLineStringSegments: LineStringSegment[],
): TargetMapPointToSourceLineSegmentSnapStatsTable {
  // Each stop point, mapped to each path segment
  return targetPoints.map((targetPoint) => {
    // For each targetPoint, snap it to each path segment.
    return sourceLineStringSegments.map(
      (segment, i): TargetMapPointToSourceLineSegmentSnapStats => {
        if (targetPoint.geometry === null) {
          return {
            segmentNum: i,
            pointCoords: null,
            snappedCoords: null,
            snappedDistAlongKm: null,
            deviationKm: Infinity,
          };
        }

        try {
          const snapped = turf.pointOnLine(segment, targetPoint);

          if (snapped === null || snapped.geometry === null) {
            return {
              segmentNum: i,
              pointCoords: targetPoint.geometry.coordinates,
              snappedCoords: null,
              snappedDistAlongKm: null,
              deviationKm: Infinity,
            };
          }

          const snappedCoords = snapped.geometry.coordinates;

          const [segmentStartCoord] = turf.getCoords(segment);
          const segmentStartPt = turf.point(segmentStartCoord);

          const snappedDistTraveled =
            turf.distance(segmentStartPt, snapped) +
            segment.properties.start_dist_along;

          const deviationKm = turf.distance(targetPoint, snapped);

          return {
            segmentNum: i,
            pointCoords: targetPoint.geometry.coordinates,
            snappedCoords,
            snappedDistAlongKm: snappedDistTraveled,
            deviationKm,
          };
        } catch (err) {
          console.error(err);
          return {
            segmentNum: i,
            pointCoords: targetPoint.geometry.coordinates,
            snappedCoords: null,
            snappedDistAlongKm: null,
            deviationKm: Infinity,
          };
        }
      },
    );
  });
}

// O(S W lg W) where S is the number of stops, W is the number of waypointCoords in the path.
// Additional O(SW) space cost, as the table is replicated.
function trySimpleMinification(
  theTable: TargetMapPointToSourceLineSegmentSnapStatsTable,
): OptimalTargetMapPointToSourceLineSegmentSnaps | null {
  // @ts-ignore
  const possibleOptimal: TargetMapPointToSourceLineSegmentSnapStats[] = theTable.map(
    (row) => _(row).sortBy(['deviationKm', 'snappedDistAlongKm']).first(),
  );

  // If
  function invariantCheck(
    projectedPointA: TargetMapPointToSourceLineSegmentSnapStats,
    projectedPointB: TargetMapPointToSourceLineSegmentSnapStats,
  ) {
    return (
      projectedPointA.snappedDistAlongKm !== null &&
      projectedPointB.snappedDistAlongKm !== null &&
      projectedPointA.snappedDistAlongKm <= projectedPointB.snappedDistAlongKm
    );
  }

  for (let i = 1; i < possibleOptimal.length; ++i) {
    const prevPossOpt = possibleOptimal[i - 1];
    const currPossOpt = possibleOptimal[i];

    if (!invariantCheck(prevPossOpt, currPossOpt)) {
      return null;
    }
  }

  // @ts-ignore
  return possibleOptimal;
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
function fitTargetPointsToSourceLineStringUsingLeastSquares(
  theTable: TargetMapPointToSourceLineSegmentSnapStatsTable,
): OptimalTargetMapPointToSourceLineSegmentSnaps | null {
  type DynamicProgrammingCell = TargetMapPointToSourceLineSegmentSnapStats & {
    cost: number;
    path: number[] | null;
  };
  type DynamicProgrammingRow = DynamicProgrammingCell[];
  type DynamicProgrammingTable = DynamicProgrammingRow[];

  const dynProgTableFirstRow = theTable[0].map((cell) => ({
    ...cell,
    cost: cell.deviationKm * cell.deviationKm,
    path: [cell.segmentNum],
  }));

  // Do dynamic programing...
  //   Looking for the lowest cost path from the first row
  // INTUITION: It seems like the no backtracking constraint can be used to
  //            reduce the search space until it is almost linear.
  const dynProgTable = theTable.slice(1).reduce(
    (acc: DynamicProgrammingTable, curTableRow, prevDynProgTableRowIdx) => {
      const prevDynProgTableRow = acc[prevDynProgTableRowIdx];

      const curDynProgTableRow: DynamicProgrammingRow = curTableRow.map(
        (curCell) => {
          // curCell is the geospatial snapping of the stop to the shape segment.

          let bestFromPreviousRow: DynamicProgrammingCell | null = null;
          let bestCostFromPreviousRow = Infinity;

          for (let i = 0; i < prevDynProgTableRow.length; ++i) {
            const prevRowCell: DynamicProgrammingCell = prevDynProgTableRow[i];

            // Is this prevRowCell the most optimal seen?
            if (
              prevRowCell.snappedDistAlongKm !== null &&
              curCell.snappedDistAlongKm !== null &&
              prevRowCell.snappedDistAlongKm <= curCell.snappedDistAlongKm &&
              prevRowCell.cost < bestCostFromPreviousRow
            ) {
              bestCostFromPreviousRow = prevRowCell.cost;
              bestFromPreviousRow = prevRowCell;
            }
          }

          // If nothing was found, cost is Infinity and path is null.
          if (
            // Redundant, but keeps type checker happy.
            bestFromPreviousRow === null ||
            bestFromPreviousRow.path === null ||
            bestCostFromPreviousRow === Infinity
          ) {
            return {
              ...curCell,
              cost: Infinity,
              path: null,
            };
          }

          const cost =
            bestCostFromPreviousRow + curCell.deviationKm * curCell.deviationKm;

          const path = [...bestFromPreviousRow.path, curCell.segmentNum];

          return {
            ...curCell,
            cost,
            path,
          };
        },
      );

      acc.push(curDynProgTableRow);

      return acc;
    },
    [dynProgTableFirstRow],
  );

  // Did we find a path that works satisfies the constraint???

  // The last row represents the cost to get from the origin to the destination.
  //   The cost is
  //      * INFINITY if the no-backtracking constraint is violated.
  //      * the sum of the squares of the distance between the stop's coords
  //        and the snapped point coords, otherwise.
  //   If the constraint failed for EVERY possible path, the min cost path is null.
  const lastDynProgTableRow = dynProgTable[dynProgTable.length - 1];

  const [{ path: optimalPath }] = lastDynProgTableRow.sort(
    (a, b) => a.cost - b.cost,
  );

  if (optimalPath === null) {
    return null;
  }

  const optimalSnappings: TargetMapPointToSourceLineSegmentSnapStats[] = optimalPath.map(
    (segmentNum, targetPointIdx) => theTable[targetPointIdx][segmentNum],
  );

  // @ts-ignore
  return optimalSnappings;
}

export default function fitStopsToPath(
  sourceLineString: turf.Feature<turf.LineString>,
  targetPoints: turf.Feature<turf.Point>[],
): OptimalTargetMapPointToSourceLineSegmentSnaps | null {
  const sourceLineStringSegments = segmentSourceLineString(sourceLineString);

  // first build the table
  const theTable = getTargetMapPointToSourceLineSegmentSnapStatsTable(
    targetPoints,
    sourceLineStringSegments,
  );

  // try the simple case
  let optimalProjections = trySimpleMinification(theTable);

  if (!optimalProjections) {
    // Simple case failed, use least squares dynamic programming.
    optimalProjections = fitTargetPointsToSourceLineStringUsingLeastSquares(
      theTable,
    );
  }

  return Array.isArray(optimalProjections) && optimalProjections.length
    ? optimalProjections
    : null;
}
