/*
    TODO: This should be an Generator
          The iterator consumer should be able to pull until
            a satisfactory path is yielded, or a distance threshold is exceeded.
*/
import * as turf from '@turf/turf';
import _ from 'lodash';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import ShstReferencesSubNet from '../../utils/ShstReferencesSubNet';

import ShstIntersectionsGeospatialIndex from './ShstIntersectionsGeospatialIndex';

import {
  SharedStreetsIntersectionId,
  ToposortedShstRefs,
} from '../../domain/types';

const getTotalLength = (features: any) =>
  features.reduce(
    (acc, tmpEdge) => acc + turf.length(tmpEdge, { units: 'miles' }),
    0,
  );

const allFromToCombos = (
  fromIntxnIds: SharedStreetsIntersectionId[],
  toIntxnIds: SharedStreetsIntersectionId[],
) =>
  _.uniqWith(
    fromIntxnIds.reduce((acc, fromIntxn) => {
      for (let i = 0; i < toIntxnIds.length; ++i) {
        const toIntxnId = toIntxnIds[i];
        acc.push([fromIntxn, toIntxnId]);
      }
      return acc;
    }, []),
    _.isEqual,
  );

export default function searchAndSort(
  vicinity: TargetMapPathVicinity,
): ToposortedShstRefs {
  const {
    targetMapPathEdges,
    targetMapPathEdgeShstMatchedShstReferences,
    // nearbyTargetMapEdgesShstMatches,
    vicinitySharedStreetsReferences,
    targetMapIsCenterline,
    // targetMapPathsAreEulerian,
  } = vicinity;

  const targetMapPathLength = getTotalLength(targetMapPathEdges);

  const pathShstMatchedRefSet = new Set(
    _.flattenDeep(targetMapPathEdgeShstMatchedShstReferences),
  );

  // const nearbyTMEdgeShstMatchedRefSet = new Set(
  // _.flattenDeep(targetMapPathEdgeShstMatchedShstReferences),
  // );

  const vicinitySubnet = new ShstReferencesSubNet(
    vicinitySharedStreetsReferences,
  );

  const vicinityIntxnIndex = new ShstIntersectionsGeospatialIndex(
    vicinitySharedStreetsReferences,
  );

  const targetMapStartEdge = _.first(targetMapPathEdges);

  const [tmPathStartLon, tmPathStartLat] = _(turf.getCoords(targetMapStartEdge))
    .flattenDeep()
    .chunk(2)
    .first();

  const targetMapEndEdge = _.last(targetMapPathEdges);

  const [tmPathEndLon, tmPathEndLat] = _(turf.getCoords(targetMapEndEdge))
    .flattenDeep()
    .chunk(2)
    .last();

  const fromNearestStart = vicinityIntxnIndex.shstReferencesFromAround(
    tmPathStartLon,
    tmPathStartLat,
    10,
  );

  const toNearestStart = vicinityIntxnIndex.shstReferencesToAround(
    tmPathStartLon,
    tmPathStartLat,
    10,
  );

  const toNearestEnd = vicinityIntxnIndex.shstReferencesToAround(
    tmPathEndLon,
    tmPathEndLat,
    10,
  );

  const fromNearestEnd = vicinityIntxnIndex.shstReferencesFromAround(
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

  const forwardFromToIntxns = allFromToCombos(
    fromNearestStartIntxns,
    toNearestEndIntxns,
  );

  const forwardAnyPaths = forwardFromToIntxns
    .map(([startIntxn, endIntxn]) =>
      vicinitySubnet.getShortestShstReferenceChain(startIntxn, endIntxn),
    )
    .filter(_.negate(_.isNull));

  const forwardPreferingShstMatches = forwardFromToIntxns
    .map(([startIntxn, endIntxn]) =>
      vicinitySubnet.getShortestShstReferenceChain(
        startIntxn,
        endIntxn,
        null,
        (shstRefs) => {
          const matches = shstRefs.filter((shstRef) =>
            pathShstMatchedRefSet.has(shstRef),
          );

          return matches.length ? matches : shstRefs;
        },
      ),
    )
    .filter(_.negate(_.isNull));

  const forwardPreferingSet = new Set(forwardPreferingShstMatches);

  const fromNearestEndIntxns = fromNearestEnd.map(
    ({ properties: { fromIntersectionId } }) => fromIntersectionId,
  );
  const toNearestStartIntxns = toNearestStart.map(
    ({ properties: { toIntersectionId } }) => toIntersectionId,
  );

  const backwardFromToIntxns = allFromToCombos(
    fromNearestEndIntxns,
    toNearestStartIntxns,
  );

  const backwardAnyPaths = targetMapIsCenterline
    ? backwardFromToIntxns
        .map(([startIntxn, endIntxn]) =>
          vicinitySubnet.getShortestShstReferenceChain(startIntxn, endIntxn),
        )
        .filter(_.negate(_.isNull))
    : [];

  const backwardPreferingShstMatches = targetMapIsCenterline
    ? backwardFromToIntxns
        .map(([startIntxn, endIntxn]) =>
          vicinitySubnet.getShortestShstReferenceChain(
            startIntxn,
            endIntxn,
            null,
            (shstRefs) => {
              const matches = shstRefs.filter((shstRef) =>
                pathShstMatchedRefSet.has(shstRef),
              );

              return matches.length ? matches : shstRefs;
            },
          ),
        )
        .filter(_.negate(_.isNull))
    : [];

  const backwardPreferingSet = new Set(backwardPreferingShstMatches);

  const forwardPaths = _.uniqBy(
    [...forwardPreferingShstMatches, ...forwardAnyPaths],
    (p) => `${p.map(({ id }) => id)}`,
  )
    .sort(
      (a, b) =>
        Math.abs(getTotalLength(a) - targetMapPathLength) *
          (forwardPreferingSet.has(a) ? 0.9 : 1) -
        Math.abs(getTotalLength(b) - targetMapPathLength) *
          (forwardPreferingSet.has(b) ? 0.9 : 1),
    )
    .slice(0, 5);

  const backwardPaths = _.uniqBy(
    [...backwardPreferingShstMatches, ...backwardAnyPaths],
    (p) => `${p.map(({ id }) => id)}`,
  )
    .sort(
      (a, b) =>
        Math.abs(getTotalLength(a) - targetMapPathLength) *
          (backwardPreferingSet.has(a) ? 0.9 : 1) -
        Math.abs(getTotalLength(b) - targetMapPathLength) *
          (backwardPreferingSet.has(b) ? 0.9 : 1),
    )
    .slice(0, 5);

  return {
    forwardPaths,
    backwardPaths,
  };
}
