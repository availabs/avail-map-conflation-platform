import * as turf from '@turf/turf';
import _ from 'lodash';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';
import ShstIntersectionsGeospatialIndex from './ShstIntersectionsGeospatialIndex';

import ShstReferencesSubNet from '../../utils/ShstReferencesSubNet';

import {
  RawTargetMapFeature,
  SharedStreetsReferenceFeature,
  SharedStreetsIntersectionId,
  TargetMapPathEdgeFeature,
} from '../../domain/types';

export type ShstIntersectionsFromToPair = [
  SharedStreetsIntersectionId,
  SharedStreetsIntersectionId,
];

export const allFromToCombos = (
  fromIntxnIds: SharedStreetsIntersectionId[],
  toIntxnIds: SharedStreetsIntersectionId[],
): ShstIntersectionsFromToPair[] =>
  _.uniqWith(
    fromIntxnIds.reduce(
      (
        acc: [SharedStreetsIntersectionId, SharedStreetsIntersectionId][],
        fromIntxn,
      ) => {
        for (let i = 0; i < toIntxnIds.length; ++i) {
          const toIntxnId = toIntxnIds[i];
          acc.push([fromIntxn, toIntxnId]);
        }
        return acc;
      },
      [],
    ),
    _.isEqual,
  );

export default function getBiDirectionalFromToIntersectionPairs(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
) {
  const {
    targetMapPathEdges,
    targetMapPathEdgeShstMatchedShstReferences,
    vicinitySharedStreetsReferences,
  } = vicinity;

  const vicinityIntxnIndex = new ShstIntersectionsGeospatialIndex(
    vicinitySharedStreetsReferences,
  );

  // @ts-ignore
  const targetMapStartEdge: TargetMapPathEdgeFeature = _.first(
    targetMapPathEdges,
  );

  // @ts-ignore
  const [tmPathStartLon, tmPathStartLat]: [number, number] = _(
    turf.getCoords(targetMapStartEdge),
  )
    .flattenDeep()
    .chunk(2)
    .first();

  // @ts-ignore
  const targetMapEndEdge: TargetMapPathEdgeFeature = _.last(targetMapPathEdges);

  // @ts-ignore
  const [tmPathEndLon, tmPathEndLat]: [number, number] = _(
    turf.getCoords(targetMapEndEdge),
  )
    .flattenDeep()
    .chunk(2)
    .last();

  // ShstMatch ShstReferences for the TMPath start edge.
  //   We definitely want these included in the candidate orign/destinations for routing.
  const targetMapPathStartEdgeShstMatchReferences =
    targetMapPathEdgeShstMatchedShstReferences[0] || [];

  // ShstMatch ShstReferences for the TMPath end edge.
  //   We definitely want these included in the candidate orign/destinations for routing.
  const targetMapPathEndEdgeShstMatchReferences =
    targetMapPathEdgeShstMatchedShstReferences[
      targetMapPathEdgeShstMatchedShstReferences.length - 1
    ] || [];

  // === FORWARD Origin/Destination ===
  //  For routes that follow the TMPath direction:

  // Use KNN to get the 10 ShstRefs with fromIntersections nearest the TMPath start point
  const fromNearestStart = vicinityIntxnIndex.shstReferencesFromAround(
    tmPathStartLon,
    tmPathStartLat,
    10,
  );

  // Use KNN to get the 10 ShstRefs with fromIntersections nearest the TMPath end point
  const toNearestEnd = vicinityIntxnIndex.shstReferencesToAround(
    tmPathEndLon,
    tmPathEndLat,
    10,
  );

  const fromNearestStartIntxns = fromNearestStart.map(
    ({ properties: { fromIntersectionId } }) => fromIntersectionId,
  );

  const toNearestEndIntxns = toNearestEnd.map(
    ({ properties: { toIntersectionId } }) => toIntersectionId,
  );

  const candidateForwardOriginShstRefs = _.uniqBy(
    [...targetMapPathStartEdgeShstMatchReferences, ...fromNearestStart],
    'id',
  );
  const candidateForwardDestinationShstRefs = _.uniqBy(
    [...targetMapPathEndEdgeShstMatchReferences, ...toNearestEnd],
    'id',
  );

  // === BACKWARD === For routes that run opposite the TMPath direction:

  // Use KNN to get the 10 ShstRefs with toIntersections nearest the TMPath start point
  const toNearestStart = vicinityIntxnIndex.shstReferencesToAround(
    tmPathStartLon,
    tmPathStartLat,
    10,
  );

  const fromNearestEnd = vicinityIntxnIndex.shstReferencesFromAround(
    tmPathEndLon,
    tmPathEndLat,
    10,
  );

  const fromNearestEndIntxns = fromNearestEnd.map(
    ({ properties: { fromIntersectionId } }) => fromIntersectionId,
  );
  const toNearestStartIntxns = toNearestStart.map(
    ({ properties: { toIntersectionId } }) => toIntersectionId,
  );

  const candidateBackwardOriginShstRefs = _.uniqBy(
    [...targetMapPathEndEdgeShstMatchReferences, ...fromNearestEnd],
    'id',
  );
  const candidateBackwardDestinationShstRefs = _.uniqBy(
    [...targetMapPathStartEdgeShstMatchReferences, ...toNearestStart],
    'id',
  );

  // Get all the ShstReferences near the TMPath start (regardless of direction)
  // @ts-ignore
  const targetMapPathStartAreaShstRefs: SharedStreetsReferenceFeature[] = _.uniqBy(
    [
      ...candidateForwardOriginShstRefs,
      ...candidateBackwardDestinationShstRefs,
    ],
    'id',
  );

  const targetMapPathStartAreaShstRefsSubnet = new ShstReferencesSubNet(
    targetMapPathStartAreaShstRefs,
  );

  // Get all the ShstReferences near the TMPath end (regardless of direction)
  // @ts-ignore
  const targetMapPathEndAreaShstRefs: SharedStreetsReferenceFeature[] = _.uniqBy(
    [
      ...candidateForwardDestinationShstRefs,
      ...candidateBackwardOriginShstRefs,
    ],
    'id',
  );

  const targetMapPathEndAreaShstRefsSubnet = new ShstReferencesSubNet(
    targetMapPathEndAreaShstRefs,
  );

  // === FORWARD ===
  // Get all candidate Origin SharedStreetsIntersections for the
  //   ShstReference chain traversing the TMPath in the forward direction
  const targetMapForwardSources = _.uniq([
    ...targetMapPathStartAreaShstRefsSubnet.simpleTwoWaySources,
    ...targetMapPathStartAreaShstRefsSubnet.simpleDirectedSources,
    ...fromNearestStartIntxns,
  ]);

  // Get all candidate Destination SharedStreetsIntersections for the
  //   ShstReference chain traversing the TMPath in the forward direction
  const targetMapForwardSinks = _.uniq([
    ...targetMapPathEndAreaShstRefsSubnet.simpleTwoWaySinks,
    ...targetMapPathEndAreaShstRefsSubnet.simpleDirectedSinks,
    ...toNearestEndIntxns,
  ]);

  // All Forward traversal Origin/Destination combinations
  const forwardFromToIntxns = allFromToCombos(
    targetMapForwardSources,
    targetMapForwardSinks,
  );

  // === BACKWARD ===
  // Get all candidate Origin SharedStreetsIntersections for the
  //   ShstReference chain traversing the TMPath in the backward direction
  const targetMapBackwardSources = _.uniq([
    ...targetMapPathEndAreaShstRefsSubnet.simpleTwoWaySources,
    ...targetMapPathEndAreaShstRefsSubnet.simpleDirectedSources,
    ...fromNearestEndIntxns,
  ]);

  // Get all candidate Destination SharedStreetsIntersections for the
  //   ShstReference chain traversing the TMPath in the backward direction
  const targetMapBackwardSinks = _.uniq([
    ...targetMapPathStartAreaShstRefsSubnet.simpleTwoWaySinks,
    ...targetMapPathStartAreaShstRefsSubnet.simpleDirectedSinks,
    ...toNearestStartIntxns,
  ]);

  // All Backward traversal Origin/Destination combinations
  const backwardFromToIntxns = allFromToCombos(
    targetMapBackwardSources,
    targetMapBackwardSinks,
  );

  return {
    forwardFromToIntxns,
    backwardFromToIntxns,
  };
}
