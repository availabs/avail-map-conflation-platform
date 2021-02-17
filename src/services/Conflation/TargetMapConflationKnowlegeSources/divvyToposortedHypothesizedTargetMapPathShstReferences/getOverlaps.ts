import _ from 'lodash';
import * as turf from '@turf/turf';
import * as ss from 'simple-statistics';

import snapPointSequenceToPath from '../../../../utils/gis/snapPointSequenceToPath';

import mergePathIntoLineString from './mergePathIntoLineString';

import {
  SharedStreetsReferenceId,
  SharedStreetsIntersectionId,
  TargetMapPathEdgeFeature,
  SharedStreetsReferenceFeature,
} from '../../domain/types';

export type SnappingSummaryStats = {
  minDeviation: number;
  maxDeviation: number;
  meanDeviation: number;
  medianDeviation: number;
  minSnapLenRatio: number;
  maxSnapLenRatio: number;
  meanSnapLenRatio: number;
  medianSnapLenRatio: number;
};

export type TargetMapPathShstReferenceOverlap = {
  shstReferenceId: SharedStreetsReferenceId;
  tmpEdgeStartDistAlongShstRefPath: number;
  tmpEdgeEndDistAlongShstRefPath: number;
  shstFromIntxnDistAlongShstRefChain: number;
  shstToIntxnDistAlongShstRefChain: number;
};

export type TargetMapPathMatchOverlapSummary = {
  tmPathEdgesStartEndSnapped: [
    turf.Feature<turf.Point>,
    turf.Feature<turf.Point>,
  ];

  targetMapPathEdgesSnappedDistancesAlong: [number, number];

  snappingSummaryStats: SnappingSummaryStats;

  shstIntxnDistancesAlongPath: Record<SharedStreetsIntersectionId, number>;

  targetMapPathShstReferenceOverlaps: TargetMapPathShstReferenceOverlap[];
};

const coordSequenceToPoints = (coordSeq: [number, number][]) =>
  coordSeq.map((coord) => turf.point(coord, {}));

const getPathToIntxnCoordsSeq = (
  features: turf.Feature<turf.LineString | turf.MultiLineString>[],
): [number, number][] => [
  // @ts-ignore
  _(turf.getCoords(_.first(features)))
    // first coordinate
    .flattenDeep()
    .chunk(2)
    .first(),

  // for each feature in the path, the last coordinate
  // @ts-ignore
  ...features.map((feature) =>
    _(turf.getCoords(feature)).flattenDeep().chunk(2).last(),
  ),
];

export default function getOverlaps(
  tmPath: TargetMapPathEdgeFeature[],
  shstRefPath: SharedStreetsReferenceFeature[],
) {
  const shstReferenceChainAsLineString = mergePathIntoLineString(shstRefPath);

  const tmPathIntxnPointSeq = coordSequenceToPoints(
    getPathToIntxnCoordsSeq(tmPath),
  );

  const snappedTMPIntxnsToShstRefPath = snapPointSequenceToPath(
    shstReferenceChainAsLineString,
    tmPathIntxnPointSeq,
  );

  if (snappedTMPIntxnsToShstRefPath === null) {
    return null;
  }

  const tmPathEdgesStartEndSnapped = tmPath.map((_$, i) => [
    snappedTMPIntxnsToShstRefPath[i],
    snappedTMPIntxnsToShstRefPath[i + 1],
  ]);

  const deviations = snappedTMPIntxnsToShstRefPath.map((s) => s.deviationKm);

  const snapLenRatios = tmPathEdgesStartEndSnapped.map(([start, end], i) =>
    _.round(
      (end.snappedDistAlongKm - start.snappedDistAlongKm) /
        turf.length(tmPath[i]),
    ),
  );

  const snappingSummaryStats = {
    minDeviation: _.round(ss.min(deviations), 5),
    maxDeviation: _.round(ss.max(deviations), 5),
    meanDeviation: _.round(ss.mean(deviations), 5),
    medianDeviation: _.round(ss.median(deviations), 5),
    minSnapLenRatio: _.round(ss.min(snapLenRatios), 5),
    maxSnapLenRatio: _.round(ss.max(snapLenRatios), 5),
    meanSnapLenRatio: _.round(ss.mean(snapLenRatios), 5),
    medianSnapLenRatio: _.round(ss.median(snapLenRatios), 5),
  };

  // note: length = shstRefPath.length + 1
  const shstIntxnDistancesAlongPath = shstRefPath.reduce(
    (acc: Record<SharedStreetsIntersectionId, number>, shstRef) => {
      const {
        properties: { fromIntersectionId, toIntersectionId },
      } = shstRef;

      const fromIntxnLenAlong = acc[fromIntersectionId] ?? 0;

      const toIntxnLenAlong = fromIntxnLenAlong + turf.length(shstRef);

      acc[fromIntersectionId] = fromIntxnLenAlong;
      acc[toIntersectionId] = toIntxnLenAlong;

      return acc;
    },
    {},
  );

  const targetMapPathEdgesSnappedDistancesAlong = tmPathEdgesStartEndSnapped
    .slice(0, -1)
    .map((_$, i) => ({
      // @ts-ignore
      startDistAlong: tmPathEdgesStartEndSnapped[i].snappedDistAlongKm,
      // @ts-ignore
      endDistAlong: tmPathEdgesStartEndSnapped[i + 1].snappedDistAlongKm,
    }));

  const overlaps = {
    tmPathEdgesStartEndSnapped,
    targetMapPathEdgesSnappedDistancesAlong,
    snappingSummaryStats,
    shstIntxnDistancesAlongPath,
    targetMapPathShstReferenceOverlaps: [],
  };

  let shstRefIdx = 0;

  for (
    let targetMapPathIdx = 0;
    targetMapPathIdx < tmPath.length;
    ++targetMapPathIdx
  ) {
    const [tmpEdgeStartSnapped, tmpEdgeEndSnapped] = tmPathEdgesStartEndSnapped[
      targetMapPathIdx
    ];

    const tmpEdgeStartDistAlongShstRefPath =
      tmpEdgeStartSnapped.snappedDistAlongKm;

    const tmpEdgeEndDistAlongShstRefPath = tmpEdgeEndSnapped.snappedDistAlongKm;

    const shstReferenceOverlaps = [];

    overlaps.targetMapPathShstReferenceOverlaps.push(shstReferenceOverlaps);

    while (shstRefIdx < shstRefPath.length) {
      const {
        id: shstReferenceId,
        properties: { fromIntersectionId, toIntersectionId },
      } = shstRefPath[shstRefIdx];

      const shstFromIntxnDistAlongShstRefChain =
        shstIntxnDistancesAlongPath[fromIntersectionId];

      const shstToIntxnDistAlongShstRefChain =
        shstIntxnDistancesAlongPath[toIntersectionId];

      // x------------------------------------x  ShstRef
      //    o---o---o---o TMPEdges

      // tmEdge BEFORE shstRef; move onto the next tmpEdge
      if (tmpEdgeEndDistAlongShstRefPath < shstFromIntxnDistAlongShstRefChain) {
        break;
      }

      // Is there overlap?
      if (
        tmpEdgeStartDistAlongShstRefPath <= shstToIntxnDistAlongShstRefChain
      ) {
        shstReferenceOverlaps.push({
          shstReferenceId,
          tmpEdgeStartDistAlongShstRefPath,
          tmpEdgeEndDistAlongShstRefPath,
          shstFromIntxnDistAlongShstRefChain,
          shstToIntxnDistAlongShstRefChain,
        });
      }

      ++shstRefIdx;
    }

    // Since TMPEdges may share a ShstRef, give the next TMPEdge a chance to claim a share of the
    --shstRefIdx;
  }

  return overlaps;
}
