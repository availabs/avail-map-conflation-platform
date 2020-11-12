/* eslint-disable no-restricted-syntax, no-continue, no-loop-func */

// Acyclic Toposorted Paths seems to work

import { Graph } from 'graphlib';

// import { METADATA } from '../../../constants/targetMapConstants';

// import getChainBearing from '../../../utils/getChainBearing';
// import getNormalizedDirection from '../../../utils/getNormalizedDirection';

import findPathsInGraph from '../../../../utils/topological/findPathsInGraph';

import { NpmrdsTmcFeature } from '../../raw_map_layer/domain';

// import nysFipsCodes from '../constants/nysFipsCodes';

// type NpmrdsGraphComponent = NpmrdsTmcFeature[];

// import { ConnectedGraph, isTree } from './domain';

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
    graph.setEdge(startNodeId, endNodeId, {
      id: feature.properties.tmc,
      // feature,
    });
  }

  return graph;
};

// const allFeaturesHaveNormalizedDirection = (
// npmrdsFeatures: NpmrdsTmcFeature[],
// ) =>
// npmrdsFeatures.every(
// (feature) => getNormalizedDirection(feature.properties.direction) !== null,
// );

// const getFeaturesFromGraph = (graph: Graph) =>
// graph.edges().map(({ v, w }) => {
// const f = graph.edge(v, w).feature;
// f.properties = {};
// return f;
// });

// const logPaths = (
// lineartmc: string,
// npmrdsFeatures: NpmrdsTmcFeature[],
// tmcPaths: TmcId[][],
// ) => {
// console.log('='.repeat(15), lineartmc, '='.repeat(15));

// const simplifiedFeaturesByTmc = npmrdsFeatures.reduce(
// (acc: Record<TmcId, turf.Feature>, f: NpmrdsTmcFeature) => {
// acc[f.properties.tmc] = { ...f, properties: {} };
// return acc;
// },
// {},
// );

// const featureCollections: turf.FeatureCollection[] = tmcPaths.map(
// (path: TmcId[]) =>
// turf.featureCollection(
// path.map((tmc: TmcId) => simplifiedFeaturesByTmc[tmc]),
// ),
// );

// featureCollections.forEach((fc) => {
// console.log();
// console.log(JSON.stringify(fc));
// console.log();
// });
// };

export default function findMesoLevelPaths(
  npmrdsTmcFeatures: NpmrdsTmcFeature[],
): NpmrdsTmcFeature['properties']['tmc'][][] {
  const graph = getNpmrdsSubgraph(npmrdsTmcFeatures);

  const paths = findPathsInGraph(graph);

  const tmcPaths = paths.map((path) => path.map((e) => graph.edge(e).id));

  return tmcPaths;
}
