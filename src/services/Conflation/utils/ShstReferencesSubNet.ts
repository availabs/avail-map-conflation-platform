/* eslint-disable no-return-assign, no-cond-assign */

import * as turf from '@turf/turf';
import _ from 'lodash';

import { Graph, Edge, alg as graphAlgs } from 'graphlib';

import {
  SharedStreetsReferenceId,
  SharedStreetsReferenceFeature,
  SharedStreetsReferenceChain,
  SharedStreetsIntersectionId,
} from '../domain/types';

export type VicinityShstSubnetEdge = {
  shstReferenceId: SharedStreetsReferenceId;
  fromIntersectionId: SharedStreetsIntersectionId;
  toIntersectionId: SharedStreetsIntersectionId;
};

export interface NamedEdge extends Edge {
  name: SharedStreetsReferenceId;
}

export type EdgeFilterFunction = (
  shstIntersectionId: SharedStreetsIntersectionId,
) => NamedEdge[];

export type EdgeWeightFunction = (e: NamedEdge) => number;

type EdgeKey = string;

export const shstReferencesToShstSubnetEdges = (
  shstReferences: SharedStreetsReferenceFeature[],
) => {
  const vicinityShstSubnetEdges: VicinityShstSubnetEdge[] = [];

  for (let i = 0; i < shstReferences.length; ++i) {
    try {
      const {
        properties: { shstReferenceId, fromIntersectionId, toIntersectionId },
      } = shstReferences[i];

      vicinityShstSubnetEdges.push({
        shstReferenceId,
        fromIntersectionId,
        toIntersectionId,
      });
    } catch (err) {
      console.log(JSON.stringify(shstReferences[i], null, 4));
      throw err;
    }
  }

  return vicinityShstSubnetEdges;
};

export function buildSourceMapSubNet(
  shstReferences: SharedStreetsReferenceFeature[],
) {
  const shstEdges = shstReferencesToShstSubnetEdges(shstReferences);

  const graph = new Graph({
    directed: true,
    compound: false,
    multigraph: true,
  });

  // For each shstMatch for this shape segment
  for (let i = 0; i < shstEdges.length; ++i) {
    const { shstReferenceId, fromIntersectionId, toIntersectionId } = shstEdges[
      i
    ];

    graph.setEdge(
      fromIntersectionId,
      toIntersectionId,
      { id: i },
      shstReferenceId,
    );
  }

  return graph;
}

export const getEdgeKey = ({ v, w }: Edge): EdgeKey => `${v}|${w}`;

export default class ShstReferencesSubNet {
  readonly shstReferences: SharedStreetsReferenceFeature[];

  readonly shstReferencesById: Record<
    SharedStreetsReferenceId,
    SharedStreetsReferenceFeature
  >;

  private readonly graph: Graph;

  private cache: {
    components?: readonly SharedStreetsIntersectionId[][];

    sources?: readonly SharedStreetsIntersectionId[];

    sinks?: readonly SharedStreetsIntersectionId[];

    componentShstIntersectionSets?: Set<SharedStreetsIntersectionId>[];

    shstReferenceLengths?: Map<SharedStreetsReferenceFeature, number>;

    simpleDirectedSourcesAndSinks?: {
      sources: readonly SharedStreetsIntersectionId[];
      sinks: readonly SharedStreetsIntersectionId[];
    };

    simpleTwoWaySourcesAndSinks?: {
      sources: readonly SharedStreetsIntersectionId[];
      sinks: readonly SharedStreetsIntersectionId[];
    };

    shstReferenceIdsByEdgeKey?: Record<EdgeKey, SharedStreetsReferenceId[]>;

    shstReferencesByEdgeKey?: Record<EdgeKey, SharedStreetsReferenceFeature[]>;
  };

  constructor(shstReferences: SharedStreetsReferenceFeature[]) {
    this.shstReferences = _.uniq(shstReferences);

    this.shstReferencesById = _.keyBy(this.shstReferences, 'id');

    this.graph = buildSourceMapSubNet(shstReferences);
    this.cache = {};
  }

  get components(): readonly SharedStreetsIntersectionId[][] {
    return (
      this.cache.components ||
      (this.cache.components = graphAlgs.components(this.graph))
    );
  }

  get componentShstIntersectionSets() {
    return (
      this.cache.componentShstIntersectionSets ||
      (this.cache.componentShstIntersectionSets = this.components.map(
        (component) => new Set(component),
      ))
    );
  }

  private get shstReferencesByEdgeKey() {
    return (
      this.cache.shstReferencesByEdgeKey ||
      (this.cache.shstReferencesByEdgeKey = this.graph
        .edges()
        .reduce(
          (
            acc: Record<string, SharedStreetsReferenceFeature[]>,
            e: NamedEdge,
          ) => {
            const shstReferenceId = e.name;

            if (shstReferenceId) {
              const shstReference = this.shstReferencesById[shstReferenceId];
              const k = getEdgeKey(e);

              acc[k] = acc[k] || [];
              acc[k].push(shstReference);
            }
            return acc;
          },
          {},
        ))
    );
  }

  private get shstReferenceLengths() {
    return (
      this.cache.shstReferenceLengths ||
      (this.cache.shstReferenceLengths = this.shstReferences.reduce(
        (acc: Map<SharedStreetsReferenceFeature, number>, shstReference) => {
          acc.set(shstReference, turf.length(shstReference));

          return acc;
        },
        new Map(),
      ))
    );
  }

  get multiEdgeShstReferences() {
    return Object.keys(this.shstReferencesByEdgeKey)
      .map((k) => this.shstReferencesByEdgeKey[k])
      .filter((shstRefsArr) => shstRefsArr.length > 1);
  }

  get hasMultiEdgeShstReferences() {
    return this.multiEdgeShstReferences.length > 0;
  }

  get sharedStreetsIntersectionIds(): SharedStreetsIntersectionId[] {
    return _.uniq(this.graph.nodes());
  }

  getShstReferencesFromIntersection(
    fromIntersectionId: SharedStreetsIntersectionId,
  ): SharedStreetsReferenceFeature[] {
    return this.shstReferences.filter(
      ({ properties: { fromIntersectionId: curFromIntxnId } }) =>
        fromIntersectionId === curFromIntxnId,
    );
  }

  getShstReferencesToIntersection(
    toIntersectionId: SharedStreetsIntersectionId,
  ) {
    return this.shstReferences.filter(
      ({ properties: { toIntersectionId: curToIntxnId } }) =>
        toIntersectionId === curToIntxnId,
    );
  }

  getIncidentShstGeometryIdsForShstIntersectionId(
    shstIntersectionId: SharedStreetsIntersectionId,
  ) {
    const geoms = new Set();

    this.getShstReferencesFromIntersection(
      shstIntersectionId,
    ).forEach(({ properties: geometryId }) => geoms.add(geometryId));

    this.getShstReferencesToIntersection(
      shstIntersectionId,
    ).forEach(({ properties: geometryId }) => geoms.add(geometryId));

    return [...geoms];
  }

  get forks() {
    return this.sharedStreetsIntersectionIds.filter((shstIntxnId) => {
      const incidentGeoms = this.getIncidentShstGeometryIdsForShstIntersectionId(
        shstIntxnId,
      );

      if (incidentGeoms.length < 2) {
        return false;
      }

      if (incidentGeoms.length > 2) {
        return true;
      }

      // Leverage oneWay/twoWay
      const inRefs = this.getShstReferencesToIntersection(shstIntxnId);
      const outRefs = this.getShstReferencesFromIntersection(shstIntxnId);

      return inRefs.length !== outRefs.length;
    });
  }

  // Basically, are their any nodes that prevent simple paths?
  //   https://en.wikipedia.org/wiki/Path_graph
  get hasForks() {
    return this.forks.length > 0;
  }

  private get simpleDirectedSourcesAndSinks() {
    this.cache.simpleDirectedSourcesAndSinks =
      this.cache.simpleDirectedSourcesAndSinks ||
      this.sharedStreetsIntersectionIds.reduce(
        (
          acc: {
            sources: SharedStreetsIntersectionId[];
            sinks: SharedStreetsIntersectionId[];
          },
          curShstIntersectionId,
        ) => {
          // The shstReferences where this node is the toIntersectionId
          const inShstRefs = this.getShstReferencesToIntersection(
            curShstIntersectionId,
          );

          const outShstRefs = this.getShstReferencesFromIntersection(
            curShstIntersectionId,
          );

          const isSimpleSource =
            inShstRefs.length === 0 && outShstRefs.length > 0;

          if (isSimpleSource) {
            acc.sources.push(curShstIntersectionId);
          }

          const isSimpleSink =
            outShstRefs.length === 0 && inShstRefs.length > 0;

          if (isSimpleSink) {
            acc.sinks.push(curShstIntersectionId);
          }

          return acc;
        },
        {
          sources: [],
          sinks: [],
        },
      );

    return this.cache.simpleDirectedSourcesAndSinks;
  }

  get simpleDirectedSources() {
    return this.simpleDirectedSourcesAndSinks.sources;
  }

  get simpleDirectedSinks() {
    return this.simpleDirectedSourcesAndSinks.sinks;
  }

  get simpleDirectedSourceSinkPairs() {
    const { sources, sinks } = this.simpleDirectedSourcesAndSinks;

    return this.getSourceSinkPairs(sources, sinks);
  }

  //  TwoWayNodes are nodes with an undirected degree of one.
  //    More specifically, a single shstGeometry begins or ends with the node.
  private get simpleTwoWaySourcesAndSinks() {
    this.cache.simpleTwoWaySourcesAndSinks =
      this.cache.simpleTwoWaySourcesAndSinks ||
      this.sharedStreetsIntersectionIds.reduce(
        (
          acc: {
            sources: SharedStreetsIntersectionId[];
            sinks: SharedStreetsIntersectionId[];
          },
          curShstIntersectionId,
        ) => {
          // The shstReferences where this node is the toIntersectionId
          const inShstRefs = this.getShstReferencesFromIntersection(
            curShstIntersectionId,
          );

          const outShstRefs = this.getShstReferencesToIntersection(
            curShstIntersectionId,
          );

          const inShstGeomIds = _(inShstRefs)
            .map('properties.geometryId')
            .uniq()
            .value();

          const outShstGeomIds = _(outShstRefs)
            .map('properties.geometryId')
            .uniq()
            .value();

          const undirectedDegreeEqualsOne =
            _.intersection(inShstGeomIds, outShstGeomIds).length === 1;

          const isSimpleTwoWaySource =
            undirectedDegreeEqualsOne && inShstRefs.length > 0;

          if (isSimpleTwoWaySource) {
            acc.sources.push(curShstIntersectionId);
          }

          const isSimpleTwoWaySink =
            undirectedDegreeEqualsOne && outShstRefs.length > 0;

          if (isSimpleTwoWaySink) {
            acc.sinks.push(curShstIntersectionId);
          }
          return acc;
        },
        {
          sources: [],
          sinks: [],
        },
      );

    return this.cache.simpleTwoWaySourcesAndSinks;
  }

  get simpleTwoWaySources() {
    return this.simpleTwoWaySourcesAndSinks.sources;
  }

  get simpleTwoWaySinks() {
    return this.simpleTwoWaySourcesAndSinks.sinks;
  }

  get simpleTwoWaySourceSinkPairs() {
    const { sources, sinks } = this.simpleTwoWaySourcesAndSinks;
    return this.getSourceSinkPairs(sources, sinks);
  }

  private getSourceSinkPairs(
    sources: readonly SharedStreetsIntersectionId[],
    sinks: readonly SharedStreetsIntersectionId[],
  ) {
    const sourceToCmpntIntxnSetArrIdx = sources.reduce((acc, srcIntxn) => {
      const cIdx = this.componentShstIntersectionSets.findIndex((intxnSet) =>
        intxnSet.has(srcIntxn),
      );

      if (cIdx > -1) {
        acc[srcIntxn] = cIdx;
      }

      return acc;
    }, {});

    const cIdxToComponentSinks = sinks.reduce(
      (acc: Record<number, SharedStreetsIntersectionId[]>, snkIntxn) => {
        const cmpntIntxnSetArrIdxIdx = this.componentShstIntersectionSets.findIndex(
          (intxnSet) => intxnSet.has(snkIntxn),
        );

        if (cmpntIntxnSetArrIdxIdx > -1) {
          acc[cmpntIntxnSetArrIdxIdx] = acc[cmpntIntxnSetArrIdxIdx] || [];
          acc[cmpntIntxnSetArrIdxIdx].push(snkIntxn);
        }

        return acc;
      },
      {},
    );

    const sourceSinkPairs = sources.reduce(
      (
        acc: {
          source: SharedStreetsIntersectionId;
          sink: SharedStreetsIntersectionId;
        }[],
        source,
      ) => {
        const cIdx = sourceToCmpntIntxnSetArrIdx[source];

        const componentSinks = cIdxToComponentSinks[cIdx];

        componentSinks
          ?.filter((sink: SharedStreetsIntersectionId) => sink !== source)
          ?.forEach((sink: SharedStreetsIntersectionId) =>
            acc.push({ source, sink }),
          );

        return acc;
      },
      [],
    );

    return sourceSinkPairs;
  }

  private defaultEdgeWeightFunction(e: NamedEdge) {
    const { name: shstRefId } = e;
    const shstRef = this.shstReferencesById[shstRefId];

    const length = this.shstReferenceLengths.get(shstRef);

    return length;
  }

  private newEdgeFilterFunction(
    edgeFn: (
      shstReferences: SharedStreetsReferenceFeature[],
    ) => SharedStreetsReferenceFeature[],
  ): EdgeFilterFunction {
    return (shstIntersectionId: SharedStreetsIntersectionId) => {
      const shstRefsFromIntxn = this.getShstReferencesFromIntersection(
        shstIntersectionId,
      );

      const shstReferences = edgeFn(shstRefsFromIntxn);

      return shstReferences.map(
        ({ id, properties: { fromIntersectionId, toIntersectionId } }) => ({
          v: fromIntersectionId,
          w: toIntersectionId,
          name: id,
        }),
      );
    };
  }

  private defaultMultiEdgeShstReferencesSelector(
    shstReferences: SharedStreetsReferenceFeature[],
  ) {
    return shstReferences.sort(
      (a, b) =>
        this.shstReferenceLengths.get(a) - this.shstReferenceLengths.get(b) ||
        a.properties.roadClass - b.properties.roadClass ||
        a.id.localeCompare(b.id),
    )[0];
  }

  getShortestShstReferenceChain(
    source: SharedStreetsIntersectionId,
    sink: SharedStreetsIntersectionId,
    edgeWeight?: EdgeWeightFunction,
    edgeFn?: EdgeFilterFunction,
    multiEdgeShstReferencesSelector = this.defaultMultiEdgeShstReferencesSelector.bind(
      this,
    ),
  ): SharedStreetsReferenceChain | null {
    const getEdgeWeight =
      edgeWeight ?? this.defaultEdgeWeightFunction.bind(this);

    const eFn = edgeFn && this.newEdgeFilterFunction(edgeFn).bind(this);

    // const paths = graphAlgs.dijkstra(this.graph, source, getEdgeWeight, eFn);
    const paths = graphAlgs.dijkstra(this.graph, source, getEdgeWeight, eFn);

    if (!Number.isFinite(paths[sink].distance)) {
      return null;
    }

    // Build the Matches path from the dijkstra output.
    let s = sink;
    let { predecessor } = paths[sink];
    const reversePath = [sink];
    while (({ predecessor } = paths[s])) {
      if (!predecessor) {
        break;
      }
      reversePath.push(predecessor);
      s = predecessor;
    }

    const path = reversePath.reverse();

    const shstReferenceChain = path.slice(0, -1).map((v, i) => {
      const w = path[i + 1];
      const k = getEdgeKey({ v, w });

      const shstReferences = this.shstReferencesByEdgeKey[k];

      return multiEdgeShstReferencesSelector(shstReferences);
    });

    return shstReferenceChain;
  }
}
