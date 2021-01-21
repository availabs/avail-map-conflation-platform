/*
  TODO:

    How to handle very short ShstRefs?

      shstRef: dd9da2d2dec11d3d628224db089f09f5
      {
          "edgeIdx": 27,
          "curOverlapLen": 0.006837668480283554,
          "nxtOverlapLen": 0.007385794540933688,
          "curSharedOverlap": {
              "shstReferenceId": "dd9da2d2dec11d3d628224db089f09f5",
              "tmpEdgeStartDistAlongShstRefPath": 20.337171300923636,
              "tmpEdgeEndDistAlongShstRefPath": 20.642308883057606,
              "shstRefFromIntxnDistAlong": 20.635471214577322,
              "shstRefToIntxnDistAlong": 20.64969467759854
          },
          "nxtSharedOverlap": {
              "shstReferenceId": "dd9da2d2dec11d3d628224db089f09f5",
              "tmpEdgeStartDistAlongShstRefPath": 20.642308883057606,
              "tmpEdgeEndDistAlongShstRefPath": 21.52592660363748,
              "shstRefFromIntxnDistAlong": 20.635471214577322,
              "shstRefToIntxnDistAlong": 20.64969467759854
          }
      }
      {
          "sharedShstRefs": [
              "f3a451d70b29c891ef566296e405e994"
          ]
      }
*/

// import { strict as assert } from 'assert';
import { writeFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';
import * as turf from '@turf/turf';
import * as ss from 'simple-statistics';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import snapPointSequenceToPath from '../../../../utils/gis/snapPointSequenceToPath';

import {
  TargetMapPathEdgeFeature,
  SharedStreetsIntersectionId,
  SharedStreetsReferenceFeature,
  ToposortedShstRefs,
  ChosenSharedStreetsMatch,
} from '../../domain/types';

const reversePath = (
  path: turf.Feature<turf.LineString | turf.MultiLineString>[],
) =>
  path
    .map((feature) =>
      turf.lineString(
        _(turf.getCoords(feature))
          .flattenDeep()
          .chunk(2)
          .filter((coord, i, coords) => !_.isEqual(coord, coords[i - 1]))
          .reverse()
          .value(),
        feature.properties,
      ),
    )
    .reverse();

const getPathToIntxnCoordsSeq = (
  features: turf.Feature<turf.LineString | turf.MultiLineString>[],
) => [
  _(turf.getCoords(_.first(features)))
    .flattenDeep()
    .chunk(2)
    .first(),
  ...features.map((feature) =>
    _(turf.getCoords(feature)).flattenDeep().chunk(2).last(),
  ),
];

const coordSequenceToPoints = (coordSeq: [number, number][]) =>
  coordSeq.map((coord) => turf.point(coord, {}));

const mergePathIntoLineString = (path: SharedStreetsReferenceFeature[]) => {
  const mergedCoords = _(path)
    .map((shstRef) => turf.getCoords(shstRef))
    .flattenDeep()
    .chunk(2)
    .filter((coord, i, coords) => !_.isEqual(coord, coords[i - 1]))
    .value();

  const lineString = turf.lineString(mergedCoords, {}, null);

  return lineString;
};

// type SnappingSummaryStats = {
// minDeviation: number;
// maxDeviation: number;
// meanDeviation: number;
// medianDeviation: number;
// minSnapLenRatio: number;
// maxSnapLenRatio: number;
// meanSnapLenRatio: number;
// medianSnapLenRatio: number;
// };

// type Overlaps = {
// tmPathEdgesStartEndSnapped: any;
// snappingSummaryStats: SnappingSummaryStats;
// shstIntxnDistancesAlongPath: Record<SharedStreetsIntersectionId, number>;
// targetMapPathShstReferenceOverlaps: any;
// };

const writeFeatureCollection = (features, fileName) =>
  writeFileSync(
    join(__dirname, `../../../../../${fileName}.geojson`),
    JSON.stringify(turf.featureCollection(features)),
  );

const getOverlaps = (
  tmPath: TargetMapPathEdgeFeature[],
  shstRefPath: SharedStreetsReferenceFeature[],
) => {
  const pathAsLineString = mergePathIntoLineString(shstRefPath);

  const tmPathIntxnPointSeq = coordSequenceToPoints(
    getPathToIntxnCoordsSeq(tmPath),
  );

  const snappedTMPIntxnsToShstRefPath = snapPointSequenceToPath(
    pathAsLineString,
    tmPathIntxnPointSeq,
  );

  if (snappedTMPIntxnsToShstRefPath === null) {
    writeFeatureCollection(tmPath, 'targetMapPath');
    writeFeatureCollection(shstRefPath, 'shstRefPath');
    return null;
  }

  writeFeatureCollection(
    snappedTMPIntxnsToShstRefPath.map(({ snappedCoords }) =>
      turf.point(snappedCoords),
    ),
    'snappedPoints',
  );

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

  // shstRefPath.forEach((shstRef) =>
  // console.log(shstRef.id, turf.length(shstRef)),
  // );

  const targetMapPathEdgesSnappedDistancesAlong = tmPathEdgesStartEndSnapped
    .slice(0, -1)
    .map((_$, i) => ({
      startDistAlong: tmPathEdgesStartEndSnapped[i].snappedDistAlongKm,
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

      const shstRefFromIntxnDistAlong =
        shstIntxnDistancesAlongPath[fromIntersectionId];

      const shstRefToIntxnDistAlong =
        shstIntxnDistancesAlongPath[toIntersectionId];

      // x------------------------------------x  ShstRef
      //    o---o---o---o TMPEdges

      // tmEdge BEFORE shstRef; move onto the next tmpEdge
      if (tmpEdgeEndDistAlongShstRefPath < shstRefFromIntxnDistAlong) {
        break;
      }

      // Is there overlap?
      if (tmpEdgeStartDistAlongShstRefPath <= shstRefToIntxnDistAlong) {
        shstReferenceOverlaps.push({
          shstReferenceId,
          tmpEdgeStartDistAlongShstRefPath,
          tmpEdgeEndDistAlongShstRefPath,
          shstRefFromIntxnDistAlong,
          shstRefToIntxnDistAlong,
        });
      }

      ++shstRefIdx;
    }

    // Since TMPEdges may share a ShstRef, give the next TMPEdge a chance to claim a share of the
    --shstRefIdx;
  }

  return overlaps;
};

// const resolveSharedSequential = (overlaps: Overlaps[]) => {
// const { targetMapPathShstReferenceOverlaps } = overlaps;

// for (
// let edgeIdx = 0;
// edgeIdx < targetMapPathShstReferenceOverlaps.length - 1;
// ++edgeIdx
// ) {
// const curEdgeOverlaps = targetMapPathShstReferenceOverlaps[edgeIdx];
// const nxtEdgeOverlaps = targetMapPathShstReferenceOverlaps[edgeIdx + 1];

// const curEdgeOverlapsByShstRef = _.keyBy(
// curEdgeOverlaps,
// 'shstReferenceId',
// );
// const nxtEdgeOverlapsByShstRef = _.keyBy(
// nxtEdgeOverlaps,
// 'shstReferenceId',
// );

// const curEdgeShstRefs = curEdgeOverlaps.map(
// ({ shstReferenceId }) => shstReferenceId,
// );

// const nxtEdgeShstRefs = nxtEdgeOverlaps.map(
// ({ shstReferenceId }) => shstReferenceId,
// );

// const sharedShstRefs = _.intersection(curEdgeShstRefs, nxtEdgeShstRefs);

// // console.log(JSON.stringify({ sharedShstRefs }, null, 4));
// assert(sharedShstRefs.length <= 1);

// if (sharedShstRefs.length === 0) {
// continue;
// }

// const [shstRef] = sharedShstRefs;

// // console.log('shstRef:', shstRef);

// const curSharedOverlap = curEdgeOverlapsByShstRef[shstRef];
// const nxtSharedOverlap = nxtEdgeOverlapsByShstRef[shstRef];

// const curOverlapLen =
// Math.min(
// curSharedOverlap.tmpEdgeEndDistAlongShstRefPath,
// curSharedOverlap.shstRefToIntxnDistAlong,
// ) -
// Math.max(
// curSharedOverlap.tmpEdgeStartDistAlongShstRefPath,
// curSharedOverlap.shstRefFromIntxnDistAlong,
// );

// const nxtOverlapLen =
// Math.min(
// nxtSharedOverlap.tmpEdgeEndDistAlongShstRefPath,
// nxtSharedOverlap.shstRefToIntxnDistAlong,
// ) -
// Math.max(
// nxtSharedOverlap.tmpEdgeStartDistAlongShstRefPath,
// nxtSharedOverlap.shstRefFromIntxnDistAlong,
// );

// // console.log(
// // JSON.stringify(
// // {
// // edgeIdx,
// // curOverlapLen,
// // nxtOverlapLen,
// // curSharedOverlap,
// // nxtSharedOverlap,
// // },
// // null,
// // 4,
// // ),
// // );
// }
// };

const overlapsToChosenShstMatches = (
  targetMapPathEdges: TargetMapPathEdgeFeature[],
  overlaps: any,
  isForward: boolean,
): ChosenSharedStreetsMatch[] => {
  const chosenShstMatches = [];
  for (let i = 0; i < targetMapPathEdges.length; ++i) {
    const { id: targetMapEdgeId } = targetMapPathEdges[i];
    const tmPathEdgeOverlaps = overlaps[i];

    for (let j = 0; j < tmPathEdgeOverlaps.length; ++j) {
      const {
        shstReferenceId,
        tmpEdgeStartDistAlongShstRefPath,
        tmpEdgeEndDistAlongShstRefPath,
        shstRefFromIntxnDistAlong,
        shstRefToIntxnDistAlong,
      } = tmPathEdgeOverlaps[j];

      // const tmEdgeLength =
      // tmpEdgeEndDistAlongShstRefPath - tmpEdgeStartDistAlongShstRefPath;
      const shstRefLength = shstRefToIntxnDistAlong - shstRefFromIntxnDistAlong;

      // console.log(
      // JSON.stringify(
      // {
      // shstReferenceId,
      // tmpEdgeStartDistAlongShstRefPath,
      // tmpEdgeEndDistAlongShstRefPath,
      // shstRefFromIntxnDistAlong,
      // shstRefToIntxnDistAlong,
      // },
      // null,
      // 4,
      // ),
      // );

      const sectionStart = Math.max(
        tmpEdgeStartDistAlongShstRefPath - shstRefFromIntxnDistAlong,
        0,
      );

      const sectionEnd = Math.min(
        shstRefLength -
          (shstRefToIntxnDistAlong - tmpEdgeEndDistAlongShstRefPath),
        shstRefLength,
      );

      chosenShstMatches.push({
        targetMapEdgeId,
        // tmEdgeLength,
        // shstRefLength,
        isForward,
        targetMapEdgeShstMatchIdx: j,
        shstReferenceId,
        sectionStart,
        sectionEnd,
      });
    }
  }

  return chosenShstMatches;
};

export default function foo(
  vicinity: TargetMapPathVicinity,
  toposortedShstRefs: ToposortedShstRefs,
) {
  const {
    targetMapPathEdges,
    // nearbyTargetMapEdges,
    // targetMapPathShstMatches,
    // vicinitySharedStreetsReferences,
  } = vicinity;

  const { forwardPaths, backwardPaths } = toposortedShstRefs;

  const reversedTargetMapPathEdges = reversePath(targetMapPathEdges);

  const forwardOverlaps = forwardPaths
    .filter(_.negate(_.isEmpty))
    .reduce(
      (acc, shstRefPath) => acc || getOverlaps(targetMapPathEdges, shstRefPath),
      null,
    );

  const backwardOverlaps = backwardPaths
    .filter(_.negate(_.isEmpty))
    .reduce(
      (acc, shstRefPath) =>
        acc || getOverlaps(reversedTargetMapPathEdges, shstRefPath),
      null,
    );

  const forward =
    forwardOverlaps &&
    overlapsToChosenShstMatches(
      targetMapPathEdges,
      forwardOverlaps.targetMapPathShstReferenceOverlaps,
      true,
    );
  const backward =
    backwardOverlaps &&
    overlapsToChosenShstMatches(
      targetMapPathEdges,
      backwardOverlaps.targetMapPathShstReferenceOverlaps,
      false,
    );

  const chosenShstMatches = {
    forward,
    backward,
  };

  // console.log(JSON.stringify(chosenShstMatches, null, 4));
  return chosenShstMatches;
}
