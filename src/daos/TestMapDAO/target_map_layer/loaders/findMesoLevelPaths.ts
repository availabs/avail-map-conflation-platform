/* eslint-disable no-restricted-syntax, no-continue, no-loop-func */

import { Graph } from 'graphlib';

import findPathsInGraph from '../../../../utils/topological/findPathsInGraph';

import { TestMapFeature } from '../../raw_map_layer/domain/types';

const getSubgraph = (features: TestMapFeature[]) => {
  const nodeIds = {};
  const edgesToNodes = {};
  let nodeIdSeq = 0;

  const graph = new Graph({
    directed: true,
    compound: false,
    multigraph: true,
  });

  for (const {
    id,
    properties: { fromIntersectionId, toIntersectionId },
  } of features) {
    // If an ID already exists for this coord in the coords->ID table,
    //   reuse the existing ID, else add a new ID to the table.
    const startNodeId =
      nodeIds[fromIntersectionId] === undefined
        ? (nodeIds[fromIntersectionId] = nodeIdSeq++)
        : nodeIds[fromIntersectionId];

    const endNodeId =
      nodeIds[toIntersectionId] === undefined
        ? (nodeIds[toIntersectionId] = nodeIdSeq++)
        : nodeIds[toIntersectionId];

    edgesToNodes[id] = [startNodeId, endNodeId];

    // The ID for the edge is the index of the shstMatch in the shstMatches array.
    graph.setEdge(
      startNodeId,
      endNodeId,
      {
        id,
        // feature,
      },
      id,
    );
  }

  return graph;
};

const getEdgeKey = ({ v, w }) => `${v}|${w}`;

export default function findMesoLevelPaths(
  testMapFeatures: TestMapFeature[],
): TestMapFeature['id'][][] {
  if (testMapFeatures.length === 1) {
    return [[testMapFeatures[0].id]];
  }

  const graph = getSubgraph(testMapFeatures);

  const edges = graph.edges();

  const edgeNodesToIds = edges.reduce((acc, { v, w, name }) => {
    const nodes = getEdgeKey({ v, w });

    acc[nodes] = acc[nodes] || [];
    acc[nodes].push(name);

    return acc;
  }, {});

  const paths = findPathsInGraph(graph);

  const needToSpice: [number, number, string[]][] = [];

  const idPaths = paths.map((path, i) =>
    path.map((e, j) => {
      const k = getEdgeKey(e);
      const ids = edgeNodesToIds[k];

      if (ids.length > 1) {
        needToSpice.push([i, j, ids.slice(1)]);
      }

      return ids[0];
    }),
  );

  // Creates a minimal splice where there was a multiedges.
  //   The minimal splice includes only the adjacent edges to the multiedge.
  //   We are simply trying to get connectivity for the TMPath.
  //     While having the entire paths may help deductions if the
  //       adjacent TMPEdges include False matches, for now we keep things simple.
  //   TODO: Consider cloning the entire path for each splice.
  const splices = needToSpice.reduce((acc: string[][], [i, j, ids]) => {
    const idPath = idPaths[i];

    for (let k = 0; k < ids.length; ++k) {
      const splice: string[] = [];
      const id = ids[k];

      const startId = idPath[j - 1];
      const endId = idPath[j + 1];

      if (startId !== undefined) {
        splice.push(startId);
      }

      splice.push(id);

      if (endId !== undefined) {
        splice.push(endId);
      }

      acc.push(splice);
    }
    return acc;
  }, []);

  idPaths.push(...splices);

  return idPaths;
}
