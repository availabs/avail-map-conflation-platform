// https://postgis.net/docs/ST_LineMerge.html
//
// As far as I can tell, node-gdal does not offer linemerge.
//
// Here's where to find the actual algorithm used by PostGIS:
//   https://stackoverflow.com/questions/36973492/whats-the-algorithm-behind-st-linemerge
//
//   The algorithm implemented in this module is NOT the PostGIS one.

import { strict as assert } from 'assert';
import { Graph, Edge, alg as GraphAlgorithms } from 'graphlib';
import * as turf from '@turf/turf';
import _ from 'lodash';

function induceSubgraphFromNodes(graph: Graph, nodes: string[]): Graph {
  const graphEdges = graph.edges();

  const nodeSet = new Set(nodes);

  const subgraph = new Graph({
    directed: true,
    compound: false,
    multigraph: false,
  });

  // All edged on the original graph param
  graphEdges
    .filter(({ v, w }) => nodeSet.has(v) && nodeSet.has(w))
    // Add these edges to the componentSubGraph
    .forEach(({ v, w }) => {
      subgraph.setEdge(v, w, graph.edge(v, w));
    });

  return subgraph;
}

function induceConnectedComponentSubgraphs(graph: Graph): Graph[] {
  const componentsNodes: string[][] = GraphAlgorithms.components(graph);

  const componentsSubGraphs = componentsNodes.map((cNodes) =>
    induceSubgraphFromNodes(graph, cNodes),
  );

  return componentsSubGraphs;
}

export function edgeFeaturesToGraph(
  edgeFeatures: turf.Feature<turf.LineString>[],
) {
  const nodeIds = {};
  let nodeIdSeq = 0;

  const graph = new Graph({
    directed: true,
    compound: false,
    multigraph: false,
  });

  for (let edgeId = 0; edgeId < edgeFeatures.length; ++edgeId) {
    const feature = edgeFeatures[edgeId];

    const coords = turf.getCoords(feature);

    assert(coords.length === 2);

    const [[startLon, startLat], [endLon, endLat]] = coords;

    // Stringified coords act as graph node IDs.
    // FIXME: This approach requires exact geospatial equality.
    //        Perhaps better to allow some error tolerance.
    const startCoordStr = `${startLon}|${startLat}`;
    const endCoordStr = `${endLon}|${endLat}`;

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

    // The ID for the edge is the index of the shstMatch in the shstMatches array.
    if (!graph.edge({ v: startNodeId, w: endNodeId })) {
      graph.setEdge(startNodeId, endNodeId, {
        id: edgeId,
      });
    }
  }

  return graph;
}

const getToposortedGraphEdges = (cGraph: Graph) => {
  const edges = cGraph.edges();
  const sources = cGraph.sources();

  // If the connected subgraph does not have a single source node,
  //   then we preserve the order of the input MultiLineString.
  const roots =
    sources.length > 0
      ? sources.sort((a, b) => +a - +b)
      : [`${Math.min(...cGraph.nodes().map((n) => +n))}`];

  const preorderTraversal = GraphAlgorithms.preorder(cGraph, roots);

  // const dijkstraRoots = roots.reduce((acc, root) => {
  // acc[root] = GraphAlgorithms.dijkstra(cGraph, root);
  // return acc;
  // }, {});

  const nodeTraversalIndices = preorderTraversal.reduce(
    (acc: Record<string, number>, node, i) => {
      acc[node] = i;
      return acc;
    },
    {},
  );

  const toposortedEdges = edges.sort((a, b) => {
    const aVIdx = nodeTraversalIndices[a.v];
    const aWIdx = nodeTraversalIndices[a.w];

    const bVIdx = nodeTraversalIndices[b.v];
    const bWIdx = nodeTraversalIndices[b.w];

    return aVIdx - bVIdx || aWIdx - bWIdx;
  });

  return toposortedEdges;
};

const getTraversalPaths = (cGraph: Graph): Edge[][] => {
  const toposortedEdges = getToposortedGraphEdges(cGraph);

  const pathsByEndNode: Map<string, Edge[][]> = new Map();

  // The first path to reach a node claims that node's highest ranked out edge.
  for (let i = 0; i < toposortedEdges.length; ++i) {
    const edge = toposortedEdges[i];
    const { v, w } = edge;
    const paths = pathsByEndNode.get(v);

    // @ts-ignore
    const path: Edge[] = (paths && paths.shift()) || [];

    path.push(edge);

    if (pathsByEndNode.has(w)) {
      // @ts-ignore
      pathsByEndNode.get(w).push(path);
    } else {
      pathsByEndNode.set(w, [path]);
    }
  }

  const paths = _.flatten([...pathsByEndNode.values()]);

  const cycles = paths.filter((p) => p[0].v === p[p.length - 1].w);

  const noncycles = _.difference(paths, cycles);

  for (let i = 0; i < noncycles.length; ++i) {
    const path = noncycles[i];
    const { v: curStartNode } = path[0];
    const { w: curEndNode } = path[path.length - 1];

    for (let j = i + 1; j < noncycles.length; ++j) {
      const otherPath = noncycles[j];
      const { v: otherStartNode } = otherPath[0];
      const { w: otherEndNode } = otherPath[otherPath.length - 1];

      if (curStartNode === otherEndNode) {
        path.unshift(...otherPath);
        noncycles.splice(j, 1);
        break;
      }

      if (curEndNode === otherStartNode) {
        path.push(...otherPath);
        noncycles.splice(j, 1);
        break;
      }
    }
  }

  const mergedPaths: Edge[][] = [];

  for (let i = 0; i < cycles.length; ++i) {
    const cycle = cycles[i];

    const { v: cycleStartNode } = cycle[0];
    const { w: cycleEndNode } = cycle[cycle.length - 1];

    const cycleEdgesStartNodeLookup = {};
    const cycleEdgesEndNodeLookup = {};

    cycle.forEach(({ v, w }, cycleEdgeIdx) => {
      cycleEdgesStartNodeLookup[v] =
        cycleEdgesStartNodeLookup[v] ?? cycleEdgeIdx;

      cycleEdgesEndNodeLookup[w] = cycleEdgesEndNodeLookup[w] ?? cycleEdgeIdx;
    });

    let j: number;
    for (j = 0; j < noncycles.length; ++j) {
      const path = noncycles[j];

      const { v: pathStartNode } = path[0];
      const { w: pathEndNode } = path[path.length - 1];

      if (cycleStartNode === pathEndNode) {
        path.push(...cycle);
        break;
      }

      if (cycleEndNode === pathStartNode) {
        path.unshift(...cycle);
        break;
      }

      // Edge index in path where the path where the cycle connects
      const pathIngressIntoCycleIndex = path.findIndex(
        ({ w }) => cycleEdgesStartNodeLookup[w] !== undefined,
      );

      if (pathIngressIntoCycleIndex > -1) {
        // rotate the cycle: https://stackoverflow.com/a/1985308/3970755
        const { w: n } = path[pathIngressIntoCycleIndex];
        const m = cycleEdgesStartNodeLookup[n];
        const rotatedCycle = [...cycle.slice(m), ...cycle.slice(0, m)];
        path.splice(pathIngressIntoCycleIndex, 0, ...rotatedCycle);
        break;
      }

      // Edge index in path where the path where the cycle connects
      const pathEgressIntoCycleIndex = path.findIndex(
        ({ v }) => cycleEdgesEndNodeLookup[v] !== undefined,
      );

      if (pathEgressIntoCycleIndex > -1) {
        // rotate the cycle: https://stackoverflow.com/a/1985308/3970755
        const { v: n } = path[pathEgressIntoCycleIndex];
        const m = cycleEdgesStartNodeLookup[n];
        const rotatedCycle = [...cycle.slice(m), ...cycle.slice(0, m)];
        path.splice(pathEgressIntoCycleIndex, 0, ...rotatedCycle);
        break;
      }
    }

    if (j === noncycles.length) {
      mergedPaths.push(cycle);
    }
  }

  mergedPaths.push(...noncycles);

  return mergedPaths;
};

// Preserve the order of the coordinates in the feature parameter.
//   If the feature contains cycles, the cycle toposort is stable.
const segmentize = (
  feature: turf.Feature<turf.LineString | turf.MultiLineString>,
) => {
  // @ts-ignore
  const coords: turf.Position[][] =
    turf.getType(feature) === 'LineString'
      ? [feature?.geometry?.coordinates]
      : feature?.geometry?.coordinates;

  if (_.isEmpty(coords)) {
    // TODO: Figure out where this is happening.
    console.warn('empty coords in segmentize');
    return [];
  }

  const featureSegments = _.flatten(
    coords.map((positions) =>
      _(positions)
        .flattenDeep()
        .chunk(2)
        .filter(
          (position, i, collection) => !_.isEqual(position, collection[i - 1]),
        )
        .reduce((acc: turf.Position[][], position, i, collection) => {
          if (i > 0) {
            acc.push([collection[i - 1], position]);
          }

          return acc;
        }, [])
        .map((positionPair) => turf.lineString(positionPair)),
    ),
  );

  return featureSegments;
};

// https://postgis.net/docs/ST_LineMerge.html
// Returns a (set of) LineString(s) formed by sewing together the constituent line work of a MULTILINESTRING.
export default function lineMerge(
  feature: turf.Feature<turf.LineString | turf.MultiLineString>,
): turf.Feature<turf.LineString>[] {
  // We run LineStrings through the process to
  //   a) clean up redundant coords
  //   b) serves as an Identity function for testing
  const edgeFeatures = segmentize(feature);
  const graph = edgeFeaturesToGraph(edgeFeatures);
  const connectedSubgraphs = induceConnectedComponentSubgraphs(graph);

  const lineStrings = connectedSubgraphs.reduce(
    (acc: turf.Feature<turf.LineString>[], cGraph) => {
      const traversals = getTraversalPaths(cGraph);

      for (let i = 0; i < traversals.length; ++i) {
        const path = traversals[i];

        // Edge IDs are their index in edgeFeatures
        const pathFeatures = path
          .map((e) => cGraph.edge(e).id)
          .map((j) => edgeFeatures[j]);

        const pathCoords = _(pathFeatures)
          .map((f) => turf.getCoords(f))
          .flattenDeep()
          .chunk(2)
          .filter(
            (position, j, collection) =>
              !_.isEqual(position, collection[j - 1]),
          )
          .value();

        const lineString = turf.lineString(pathCoords);
        acc.push(lineString);
      }
      return acc;
    },
    [],
  );

  return lineStrings;
}
