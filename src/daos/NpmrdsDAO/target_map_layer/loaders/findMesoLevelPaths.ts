/* eslint-disable no-restricted-syntax, no-continue, no-loop-func */

import { Graph } from 'graphlib';

import findPathsInGraph from '../../../../utils/topological/findPathsInGraph';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

const getNpmrdsSubgraph = (features: NpmrdsTmcFeature[]) => {
  const nodeIds = {};
  const edgesToNodes = {};
  let nodeIdSeq = 0;

  const graph = new Graph({
    directed: true,
    compound: false,
    multigraph: true,
  });

  // For each shstMatch for this shape segment
  for (let i = 0; i < features.length; ++i) {
    const feature = features[i];
    const tmc = feature.id;

    const {
      properties: {
        start_longitude,
        start_latitude,
        end_longitude,
        end_latitude,
      },
    } = feature;

    // Stringified coords act as graph node IDs.
    // FIXME: This approach requires exact geospatial equality.
    //        Perhaps better to allow some error tolerance.
    const startCoordStr = `${start_longitude}|${start_latitude}`;
    const endCoordStr = `${end_longitude}|${end_latitude}`;

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

    edgesToNodes[feature.properties.tmc] = [startNodeId, endNodeId];

    // The ID for the edge is the index of the shstMatch in the shstMatches array.
    graph.setEdge(
      startNodeId,
      endNodeId,
      {
        id: tmc,
        // feature,
      },
      tmc,
    );
  }

  return graph;
};

const getEdgeKey = ({ v, w }) => `${v}|${w}`;

export default function findMesoLevelPaths(
  npmrdsTmcFeatures: NpmrdsTmcFeature[],
): NpmrdsTmcFeature['properties']['tmc'][][] {
  if (npmrdsTmcFeatures.length === 1) {
    return [[npmrdsTmcFeatures[0].id]];
  }

  const graph = getNpmrdsSubgraph(npmrdsTmcFeatures);

  const edges = graph.edges();

  const edgeNodesToTmcs = edges.reduce((acc, { v, w, name }) => {
    const nodes = getEdgeKey({ v, w });

    acc[nodes] = acc[nodes] || [];
    acc[nodes].push(name);

    return acc;
  }, {});

  const paths = findPathsInGraph(graph);

  const needToSpice: [number, number, string[]][] = [];

  const tmcPaths = paths.map((path, i) =>
    path.map((e, j) => {
      const k = getEdgeKey(e);
      const tmcs = edgeNodesToTmcs[k];

      if (tmcs.length > 1) {
        needToSpice.push([i, j, tmcs.slice(1)]);
      }

      return tmcs[0];
    }),
  );

  // Creates a minimal splice where there was a multiedges.
  //   The minimal splice includes only the adjacent edges to the multiedge.
  //   We are simply trying to get connectivity for the TMPath.
  //     While having the entire paths may help deductions if the
  //       adjacent TMPEdges include False matches, for now we keep things simple.
  //   TODO: Consider cloning the entire path for each splice.
  const splices = needToSpice.reduce((acc: string[][], [i, j, tmcs]) => {
    const tmcPath = tmcPaths[i];

    for (let k = 0; k < tmcs.length; ++k) {
      const splice: string[] = [];
      const tmc = tmcs[k];

      const startTmc = tmcPath[j - 1];
      const endTmc = tmcPath[j + 1];

      if (startTmc !== undefined) {
        splice.push(startTmc);
      }

      splice.push(tmc);

      if (endTmc !== undefined) {
        splice.push(endTmc);
      }

      acc.push(splice);
    }
    return acc;
  }, []);

  tmcPaths.push(...splices);

  return tmcPaths;
}
