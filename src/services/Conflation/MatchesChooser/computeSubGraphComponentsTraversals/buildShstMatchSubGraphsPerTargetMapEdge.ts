/* eslint-disable no-continue */

// Builds a graph with all the start_nodes and end_nodes in the shstMatches.
//   The weights of the edges is determined by the getEdgeWeight function defined above.

// TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO
//
// ??? Ideal place to search the SourceMap for Matches that improve connectivity ???

// FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME
// LOTS of assumptions here on how to select the optimal paths
//   Consider assumptions in getEdgeWeight, their consequences, and alternatives.

import * as turf from '@turf/turf';
import { Graph } from 'graphlib';
import memoizeOne from 'memoize-one';
import _ from 'lodash';

import removeRedundantCoords from './removeRedundantCoords';

export const getCleanedCoords = memoizeOne((feature) =>
  removeRedundantCoords(turf.getCoords(feature)),
);

// FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME
// ??? Replace with Hausdorff or Frechet ???
export function getRootMeanSquareDeviation(targetMapPathEdge, shstMatch) {
  // Ordered list of all vertices in the shstMatch
  const shstMatchVertices = getCleanedCoords(shstMatch).map((coord) =>
    turf.point(coord),
  );

  // Handles MultiLineStrings
  const linestrings =
    turf.getType(targetMapPathEdge) === 'LineString'
      ? [targetMapPathEdge]
      : turf
          .getCoords(targetMapPathEdge)
          .map((coords) => turf.lineString(coords));

  return Math.sqrt(
    shstMatchVertices.reduce(
      (acc, pt) =>
        acc +
        // NOTE: Using meters since squaring.
        Math.min(
          ...linestrings.map((linestring) =>
            turf.pointToLineDistance(pt, linestring, { units: 'meters' }),
          ),
        ) **
          2,
      0,
    ) / shstMatchVertices.length,
  );
}

export function getEdgeWeight(targetMapPathEdge, shstMatch) {
  // Get the Root Mean Squared Deviation between
  //   the shstMatch's vertices and the original TargetMap Edge.
  const rmsd = getRootMeanSquareDeviation(targetMapPathEdge, shstMatch);

  // TODO: Consider implications.
  // The edgeWeight: length * rmsd
  const edgeWeight = turf.length(shstMatch) * rmsd;

  return edgeWeight;
}

export default function buildShstMatchSubGraphsPerTargetMapEdge(
  targetMapPathMatches,
) {
  if (!targetMapPathMatches?.length) {
    return null;
  }

  const nodeIds = {};
  let nodeIdSeq = 0;

  const subGraphsPerTargetMapEdge = targetMapPathMatches.map(
    ({ targetMapPathEdge, shstMatches }) => {
      if (_.isEmpty(shstMatches)) {
        return null;
      }

      const subGraph = new Graph({
        directed: true,
        compound: false,
        multigraph: false,
      });

      // For each shstMatch for this shape segment
      for (let j = 0; j < shstMatches.length; ++j) {
        const shstMatch = shstMatches[j];

        const coords = getCleanedCoords(shstMatch);

        if (coords.length < 2) {
          continue;
        }

        // Stringified coords act as graph node IDs.
        // FIXME: This approach requires exact geospatial equality.
        //        Perhaps better to allow some error tolerance.
        const startCoordStr = JSON.stringify(_.first(coords));
        const endCoordStr = JSON.stringify(_.last(coords));

        // If an ID already exists for this coord in the coords->ID table,
        //   reuse the existing ID, else add a new ID to the table.
        const startNodeId =
          nodeIds[startCoordStr] === undefined
            ? (nodeIds[startCoordStr] = nodeIdSeq++)
            : nodeIds[startCoordStr];

        const endNodeId =
          nodeIds[endCoordStr] === undefined
            ? (nodeIds[endCoordStr] = nodeIdSeq++)
            : nodeIds[endCoordStr];

        const edgeWeight = getEdgeWeight(targetMapPathEdge, shstMatch);

        // The ID for the edge is the index of the shstMatch in the shstMatches array.
        subGraph.setEdge(startNodeId, endNodeId, {
          id: j,
          edgeWeight,
          shstMatch,
        });
      }

      return subGraph;
    },
  );

  return Array.isArray(subGraphsPerTargetMapEdge) &&
    subGraphsPerTargetMapEdge.filter((g) => g).length
    ? subGraphsPerTargetMapEdge
    : null;
}
