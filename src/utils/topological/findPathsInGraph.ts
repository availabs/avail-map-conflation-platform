/* eslint-disable no-restricted-syntax, no-continue, no-loop-func */

// Acyclic Toposorted Paths seems to work

import _ from 'lodash';
import { Graph, Edge, Path, alg as graphAlgs } from 'graphlib';

type Node = string;
type Source = Node;
type DijkstraAllOutput = Record<Source, Record<Node, Path>>;

export function getPath(paths: any, to: string): Edge[] | null {
  let { predecessor } = paths[to];

  if (_.isNil(predecessor)) {
    return null;
  }

  const nodesSequence = [to];

  for (let i = 0; i < nodesSequence.length; ++i) {
    const node = nodesSequence[nodesSequence.length - 1];

    predecessor = paths[node].predecessor;

    if (predecessor) {
      nodesSequence.push(predecessor);
    }
  }

  nodesSequence.reverse();

  const path = nodesSequence.slice(1).map((w, i) => {
    const v = nodesSequence[i];
    return { v, w };
  });

  return path;
}

export const getMaxPathLength = (
  dijkstraAllOutput: DijkstraAllOutput,
  source: Source,
) =>
  Math.max(
    ...Object.keys(dijkstraAllOutput[source])
      .map((destination) => dijkstraAllOutput[source][destination].distance)
      .filter((dist) => Number.isFinite(dist)),
  );

export const rankNodesByMaxPathLength = (
  dijkstraAllOutput: DijkstraAllOutput,
  a: Source,
  b: Source,
) => {
  const aMaxPathLength = getMaxPathLength(dijkstraAllOutput, a);
  const bMaxPathLength = getMaxPathLength(dijkstraAllOutput, b);

  return bMaxPathLength - aMaxPathLength;
};

export default function findPathsInGraph(graph: Graph): Edge[][] {
  const dijkstraAllOutput = graphAlgs.dijkstraAll(graph);

  const comparator = rankNodesByMaxPathLength.bind(null, dijkstraAllOutput);

  const rankedNodes = Object.keys(dijkstraAllOutput).sort(comparator);

  const visitedEdgeSources = new Set();

  const allPaths = rankedNodes.reduce((acc: any[], source) => {
    // If a previous traversal visitedEdgeSources this source, we can skip it.
    // All of its paths are necessarily subpaths of the earlier ones
    //   since all paths from this source were covered by the them.
    const dijkstraFromSource = dijkstraAllOutput[source];

    const canididateDestinations = Object.keys(dijkstraFromSource);

    const predecessors = new Set(
      canididateDestinations
        .map((n) => dijkstraFromSource[n].predecessor)
        .filter((predecessor) => predecessor),
    );

    // Filter out all nodes that are predecessors along longer paths.
    //   Not interested in subpaths.
    const destinations = canididateDestinations.filter(
      (n) => !visitedEdgeSources.has(n) && !predecessors.has(n),
      // (n) => !predecessors.has(n),
    );

    const paths = destinations
      .map((dest) => getPath(dijkstraFromSource, dest))
      .filter((path) => path !== null);

    // Cannot filter out the destinations
    //   a 🡢 b 🡠 c     ((a,b), (b,c))
    //   a 🡠🡢 b 🡠🡢 c   ((a,b,c), (c,b,a))
    paths.forEach((path) =>
      path?.forEach(({ v }) => {
        visitedEdgeSources.add(v);
      }),
    );

    acc.push(...paths);

    return acc;
  }, []);

  return allPaths;

  // TODO: Concatenate paths were origin for one Path is destination of another.
  // const {
  // byOrigin,
  // byDestination,
  // }: {
  // byOrigin: Record<string, Edge[][]>;
  // byDestination: Record<string, Edge[][]>;
  // } = allPaths.reduce(
  // (acc, path) => {
  // const {v: origin} = path[0];
  // const {w: destination} = path[path.length - 1];

  // acc.byOrigin[origin] = acc.byOrigin[origin] || [];
  // acc.byOrigin[origin].push(path);

  // acc.byDestination[destination] = acc.byDestination[destination] || [];
  // acc.byDestination[destination].push(path);

  // return acc;
  // },
  // {byOrigin: {}, byDestination: {}},
  // );

  // TODO: Test that there are no subpaths
  // const filtered = sorted.filter(
  // (path, i) => !sorted.slice(0, i).some((other) => isSubstring(path, other)),
  // );

  // return filtered;
  // return sorted;
}
