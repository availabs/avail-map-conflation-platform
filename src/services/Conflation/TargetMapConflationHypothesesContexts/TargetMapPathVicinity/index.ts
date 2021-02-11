/* eslint-disable no-restricted-syntax, @typescript-eslint/no-loop-func */

import * as turf from '@turf/turf';
import _ from 'lodash';

import * as SourceMapDAO from '../../../../daos/SourceMapDao';

import TargetMapConflationBlackboardDao from '../../TargetMapConflationBlackboardDao';

import {
  SharedStreetsReferenceId,
  SharedStreetsReferenceFeature,
  SharedStreetsGeometryId,
  SharedStreetsRoadClass,
  SharedStreetsIntersectionId,
  SharedStreetsMatchFeature,
  TargetMapPathId,
  TargetMapEdgeFeature,
  TargetMapPathEdgeFeature,
  TargetMapPathMatches,
  TargetMapPathMatchesRecord,
  TargetMapEdgeShstMatches,
  ChosenMatchFeature,
} from '../../domain/types';

import getBufferPolygonCoordsForFeatures from './getBufferPolygonCoordsForFeatures';

export interface ShstMatchesSummaryStats {
  shstMatches: SharedStreetsMatchFeature[];
  minSegmentStartKm: number;
  maxSegmentEndKm: number;
}

export interface SharedStreetsMatchesForReferenceSummary {
  shstReference: SharedStreetsReferenceFeature;
  shstReferenceLength: number;
  shstMatchesForSharedShstReference: SharedStreetsMatchFeature[];
  shstMatchesSummaryStats: {
    cur: ShstMatchesSummaryStats;
    next: ShstMatchesSummaryStats;
  };
}

export interface SequentialTargetMapPathEdgesSharingShstMatches {
  targetMapPathIdx: TargetMapPathEdgeFeature['properties']['targetMapPathIdx'];
  targetMapPathEdge: TargetMapPathEdgeFeature;
  sharedShstMatchReferencesSummary: Record<
    SharedStreetsMatchFeature['properties']['shstReferenceId'],
    SharedStreetsMatchesForReferenceSummary
  > | null;
}

export type SequentialTargetMapPathEdgesSharingShstReferenceEntry = {
  currentEdge: SequentialTargetMapPathEdgesSharingShstMatches;
  nextEdge: SequentialTargetMapPathEdgesSharingShstMatches;
  sharedShstReferences: SharedStreetsReferenceFeature[];
};

export type SequentialTargetMapPathEdgesSharingShstReferences = SequentialTargetMapPathEdgesSharingShstReferenceEntry[];

// Comprehensive context for the Blackboard Vocabulary
export default class TargetMapPathVicinity {
  private readonly bbDao: TargetMapConflationBlackboardDao;

  readonly targetMapPathMatchesRecord: TargetMapPathMatchesRecord;

  readonly sharedStreetsMatchedReferenceIds: Set<SharedStreetsReferenceId>;

  readonly shstMatchReferenceIdsPerTMPEdge: Set<SharedStreetsReferenceId>[];

  readonly sharedStreetsMatchedReferences: SharedStreetsReferenceFeature[];

  readonly targetMapPathEdges: TargetMapPathEdgeFeature[];

  readonly nearbyTargetMapEdges: TargetMapEdgeFeature[];

  private vicinityBoundingPolyCoords: turf.Polygon['coordinates'];

  // Parallel Array with TMPEdges, entries are Sets of ShstMatchIds.
  readonly targetMapPathEdgeShstMatchIds: Set<
    SharedStreetsMatchFeature['id']
  >[];

  readonly targetMapPathShstMatches: SharedStreetsMatchFeature[];

  readonly allVicinitySharedStreetsReferences: SharedStreetsReferenceFeature[];

  readonly allVicinitySharedStreetsReferencesById: Record<
    SharedStreetsReferenceId,
    SharedStreetsReferenceFeature
  >;

  readonly targetMapPathEdgeShstMatchedShstReferences: SharedStreetsReferenceFeature[][];

  readonly targetMapPathEdgeShstMatchedShstGeometryIds: SharedStreetsGeometryId[][];

  private readonly cache: {
    targetMapPathShstReferenceIdChains?: {
      from: string;
      to: string;
      shstRefIdChain: string[];
    }[][];

    shstMatchedReferencesByFromIntersectionId?: Record<
      SharedStreetsIntersectionId,
      SharedStreetsReferenceFeature[]
    >;

    shstMatchedReferencesByToIntersectionId?: Record<
      SharedStreetsIntersectionId,
      SharedStreetsReferenceFeature[]
    >;

    vicinityShstReferencesByFromIntersectionId?: Record<
      SharedStreetsIntersectionId,
      SharedStreetsReferenceFeature[]
    >;

    vicinityShstReferencesByToIntersectionId?: Record<
      SharedStreetsIntersectionId,
      SharedStreetsReferenceFeature[]
    >;
  };

  // readonly targetMapPathEdgeShstMatchedShstReferenceChains: DirectionalShstReferenceChains[];

  readonly vicinitySharedStreetsReferences: SharedStreetsReferenceFeature[];

  readonly roadClassOtherSharedStreetsReferences: SharedStreetsReferenceFeature[];

  readonly nearbyTargetMapEdgesShstMatches: SharedStreetsMatchFeature[];

  readonly vicinityShstMatches: SharedStreetsMatchFeature[];

  readonly targetMapPathShstMatchesByShstReferenceId: Record<
    SharedStreetsReferenceId,
    SharedStreetsMatchFeature[]
  >;

  readonly targetMapPathChosenFeatures: ChosenMatchFeature[][];

  readonly nearbyTargetMapEdgesChosenFeatures: ChosenMatchFeature[][];

  readonly vicinityTargetMapEdgesShstMatches: TargetMapEdgeShstMatches[];

  constructor(
    bbDao: TargetMapConflationBlackboardDao,
    targetMapPathId: TargetMapPathId,
    // targetMapPathMatchesRecord: TargetMapPathMatchesRecord,
  ) {
    this.bbDao = bbDao;

    this.targetMapPathMatchesRecord = bbDao.getTargetMapPathMatches(
      targetMapPathId,
    );

    this.cache = {};

    this.targetMapPathEdges = [];
    this.targetMapPathEdgeShstMatchIds = [];
    this.targetMapPathShstMatches = [];

    this.sharedStreetsMatchedReferenceIds = new Set();

    this.shstMatchReferenceIdsPerTMPEdge = [];

    const shstMatchRefIdToTMPEdgeIdxs: Record<string, number[]> = {};

    if (this.targetMapPathMatches !== null) {
      for (
        let targetMapEdgeIdx = 0;
        targetMapEdgeIdx < this.targetMapPathMatches.length;
        ++targetMapEdgeIdx
      ) {
        const { targetMapPathEdge, shstMatches } = this.targetMapPathMatches[
          targetMapEdgeIdx
        ];

        this.shstMatchReferenceIdsPerTMPEdge[targetMapEdgeIdx] = new Set();

        const shstMatchIds: Set<SharedStreetsMatchFeature['id']> = new Set();
        this.targetMapPathEdgeShstMatchIds.push(shstMatchIds);

        this.targetMapPathEdges.push(targetMapPathEdge);

        if (shstMatches !== null) {
          for (let i = 0; i < shstMatches.length; ++i) {
            const shstMatch = shstMatches[i];
            const shstMatchId = shstMatch.id;

            shstMatchIds.add(shstMatchId);
            this.targetMapPathShstMatches.push(shstMatch);

            const {
              properties: { shstReferenceId },
            } = shstMatch;

            this.sharedStreetsMatchedReferenceIds.add(shstReferenceId);

            this.shstMatchReferenceIdsPerTMPEdge[targetMapEdgeIdx].add(
              shstReferenceId,
            );

            shstMatchRefIdToTMPEdgeIdxs[shstReferenceId] =
              shstMatchRefIdToTMPEdgeIdxs[shstReferenceId] || [];

            shstMatchRefIdToTMPEdgeIdxs[shstReferenceId].push(targetMapEdgeIdx);
          }
        }
      }
    }

    const crossMapVicinityFeatures = [
      ...this.targetMapPathEdges,
      ...this.targetMapPathShstMatches,
    ];

    this.vicinityBoundingPolyCoords = getBufferPolygonCoordsForFeatures(
      crossMapVicinityFeatures,
    );

    this.allVicinitySharedStreetsReferences = SourceMapDAO.getShstReferenceFeaturesOverlappingPoly(
      this.vicinityBoundingPolyCoords[0],
    );

    this.allVicinitySharedStreetsReferencesById = _.keyBy(
      this.allVicinitySharedStreetsReferences,
      'id',
    );

    // console.log(JSON.stringify(this.shstMatchReferenceIdsPerTMPEdge, null, 4));
    this.targetMapPathEdgeShstMatchedShstReferences = this.shstMatchReferenceIdsPerTMPEdge.map(
      (shstRefIdSet) =>
        [...shstRefIdSet].map(
          (shstRefId) => this.allVicinitySharedStreetsReferencesById[shstRefId],
        ),
    );

    this.targetMapPathEdgeShstMatchedShstGeometryIds = this.targetMapPathEdgeShstMatchedShstReferences.map(
      (edgeMatchedRefs) => [
        ...new Set(
          edgeMatchedRefs.map(({ properties: { geometryId } }) => geometryId),
        ),
      ],
    );

    // See ../documentation/NonVehicleWays.md
    // All the ShstReferences intersecting the Vicinity.
    this.vicinitySharedStreetsReferences = this.allVicinitySharedStreetsReferences.filter(
      (shstRef) =>
        shstRef.properties.roadClass !== SharedStreetsRoadClass.Other,
    );

    // We keep track of the nonVehicleSharedStreetsReferences so we can identify
    //   where vehicle ShstReferences intersections are broken up into small segments
    //   because of crosswalks.
    this.roadClassOtherSharedStreetsReferences = this.allVicinitySharedStreetsReferences.filter(
      (shstRef) =>
        shstRef.properties.roadClass === SharedStreetsRoadClass.Other,
    );

    this.sharedStreetsMatchedReferences = this.vicinitySharedStreetsReferences.filter(
      ({ id }) => this.sharedStreetsMatchedReferenceIds.has(id),
    );

    // In our request for VicinityTMPEdges, exclude those that we already have from the TMPath.
    const excludedTargetMapEdges = this.targetMapPathEdges.map(({ id }) => id);

    this.vicinityTargetMapEdgesShstMatches = this.bbDao.getVicinityTargetMapEdgesShstMatches(
      this.vicinityBoundingPolyCoords,
      { excludedTargetMapEdges },
    );

    this.nearbyTargetMapEdges = this.vicinityTargetMapEdgesShstMatches.map(
      ({ targetMapEdge }) => targetMapEdge,
    );

    this.nearbyTargetMapEdgesShstMatches = this.vicinityTargetMapEdgesShstMatches.reduce(
      (acc: SharedStreetsMatchFeature[], { shstMatches }) => {
        if (shstMatches !== null) {
          shstMatches.forEach((m) => acc.push(m));
        }
        return acc;
      },
      [],
    );

    const vicinityTargetMapEdgeIds = [
      ...this.targetMapPathEdges.map(({ id }) => id),
      ...this.nearbyTargetMapEdges.map(({ id }) => id),
    ];

    const chosenMatchFeatures = this.bbDao.getChosenShstMatchesForTargetMapEdges(
      vicinityTargetMapEdgeIds,
    );

    this.targetMapPathChosenFeatures = this.targetMapPathEdges.map(
      (_$, i) => chosenMatchFeatures[i],
    );

    this.nearbyTargetMapEdgesChosenFeatures = this.nearbyTargetMapEdges.map(
      (_$, i) => chosenMatchFeatures[i + this.targetMapPathEdges.length],
    );

    this.vicinityShstMatches = [
      ...this.targetMapPathShstMatches,
      ...this.nearbyTargetMapEdgesShstMatches,
    ];

    this.targetMapPathShstMatchesByShstReferenceId = this.targetMapPathShstMatches.reduce(
      (acc, shstMatch) => {
        const {
          properties: { shstReferenceId },
        } = shstMatch;

        acc[shstReferenceId] = acc[shstReferenceId] || [];
        acc[shstReferenceId].push(shstMatch);

        return acc;
      },
      {},
    );

    // Sort the shstMatches
    Object.values(this.targetMapPathShstMatchesByShstReferenceId).forEach(
      (shstMatches) =>
        shstMatches.sort((a, b) => {
          const [aStart, aEnd] = a.properties.section;
          const [bStart, bEnd] = b.properties.section;

          return aStart - bStart || aEnd - bEnd;
        }),
    );
  }

  get targetMapIsCenterline() {
    return this.bbDao.targetMapIsCenterline;
  }

  get targetMapPathMatches(): TargetMapPathMatches | null {
    return this.targetMapPathMatchesRecord.targetMapPathMatches;
  }

  get targetMapPathsAreEulerian() {
    return this.bbDao.targetMapPathsAreEulerian;
  }

  get targetMapPathId(): TargetMapPathId {
    return this.targetMapPathMatchesRecord.targetMapPathId;
  }

  get targetMapPathEdgesFeatureCollection() {
    return turf.featureCollection(this.targetMapPathEdges);
  }

  get vicinityShstReferecncesFeatureCollection() {
    return turf.featureCollection(this.vicinitySharedStreetsReferences);
  }

  get vicinityPolygon() {
    return turf.polygon(this.vicinityBoundingPolyCoords);
  }

  get shstMatchedReferencesByFromIntersectionId() {
    if (!this.cache.shstMatchedReferencesByFromIntersectionId) {
      this.cache.shstMatchedReferencesByFromIntersectionId = this.vicinitySharedStreetsReferences.reduce(
        (acc, shstRef) => {
          const {
            properties: { fromIntersectionId },
          } = shstRef;

          acc[fromIntersectionId] = acc[fromIntersectionId] || [];
          acc[fromIntersectionId].push(shstRef);

          return acc;
        },
        {},
      );
    }

    return this.cache.shstMatchedReferencesByFromIntersectionId;
  }

  get shstMatchedReferencesByToIntersectionId() {
    if (!this.cache.shstMatchedReferencesByToIntersectionId) {
      this.cache.shstMatchedReferencesByToIntersectionId = this.vicinitySharedStreetsReferences.reduce(
        (acc, shstRef) => {
          const {
            properties: { toIntersectionId },
          } = shstRef;

          acc[toIntersectionId] = acc[toIntersectionId] || [];
          acc[toIntersectionId].push(shstRef);

          return acc;
        },
        {},
      );
    }

    return this.cache.shstMatchedReferencesByToIntersectionId;
  }

  getShstMatchedReferencesByIntersectionIds(
    from: SharedStreetsIntersectionId,
    to: SharedStreetsIntersectionId,
  ) {
    return _.intersection(
      this.shstMatchedReferencesByFromIntersectionId[from],
      this.shstMatchedReferencesByToIntersectionId[to],
    );
  }

  get vicinityShstReferencesByFromIntersectionId() {
    if (!this.cache.vicinityShstReferencesByFromIntersectionId) {
      this.cache.vicinityShstReferencesByFromIntersectionId = this.vicinitySharedStreetsReferences.reduce(
        (acc, shstRef) => {
          const {
            properties: { fromIntersectionId },
          } = shstRef;

          acc[fromIntersectionId] = acc[fromIntersectionId] || [];
          acc[fromIntersectionId].push(shstRef);

          return acc;
        },
        {},
      );
    }

    return this.cache.vicinityShstReferencesByFromIntersectionId;
  }

  get vicinityShstReferencesByToIntersectionId() {
    if (!this.cache.vicinityShstReferencesByToIntersectionId) {
      this.cache.vicinityShstReferencesByToIntersectionId = this.vicinitySharedStreetsReferences.reduce(
        (acc, shstRef) => {
          const {
            properties: { toIntersectionId },
          } = shstRef;

          acc[toIntersectionId] = acc[toIntersectionId] || [];
          acc[toIntersectionId].push(shstRef);

          return acc;
        },
        {},
      );
    }

    return this.cache.vicinityShstReferencesByToIntersectionId;
  }

  getVicinityShstReferencesByIntersectionIds(
    from: SharedStreetsIntersectionId,
    to: SharedStreetsIntersectionId,
  ) {
    return _.intersection(
      this.vicinityShstReferencesByFromIntersectionId[from],
      this.vicinityShstReferencesByToIntersectionId[to],
    );
  }

  getTargetMapPathEdgeShstMatchesForShstReference(
    targetMapPathEdgeIdx: number,
    shstReferenceId: SharedStreetsReferenceId,
  ) {
    return this.targetMapPathShstMatchesByShstReferenceId[
      shstReferenceId
    ].filter(({ id }) =>
      this.targetMapPathEdgeShstMatchIds[targetMapPathEdgeIdx].has(id),
    );
  }

  get vicinity() {
    return {
      targetMapPathId: this.targetMapPathId,
      targetMapPathEdges: this.targetMapPathEdges,
      targetMapPathMatches: this.targetMapPathMatches,
      targetMapPathShstMatches: this.targetMapPathShstMatches,
      targetMapPathEdgeShstMatchedShstReferences: this
        .targetMapPathEdgeShstMatchedShstReferences,
      sharedStreetsMatchedReferences: this.sharedStreetsMatchedReferences,
      nearbyTargetMapEdges: this.nearbyTargetMapEdges,
      nearbyTargetMapEdgesShstMatches: this.nearbyTargetMapEdgesShstMatches,
      vicinityShstMatches: this.vicinityShstMatches,
      vicinityPolygon: this.vicinityPolygon,
      vicinitySharedStreetsReferences: this.vicinitySharedStreetsReferences,
      vicinityTargetMapEdgesShstMatches: this.vicinityTargetMapEdgesShstMatches,
    };
  }
}
