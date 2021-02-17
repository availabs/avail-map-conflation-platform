// import { strict as assert } from 'assert';
import _ from 'lodash';
import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import reverseTargetMapPathCoordinates from './reverseTargetMapPathCoordinates';

import getOverlaps from './getOverlaps';

import {
  RawTargetMapFeature,
  TargetMapPathEdgeFeature,
  ToposortedShstRefs,
  ChosenMatchFeature,
} from '../../domain/types';

const overlapsToChosenShstMatches = (
  targetMapPathEdges: TargetMapPathEdgeFeature[],
  overlaps: any,
  isForward: boolean,
): ChosenMatchFeature[] => {
  const chosenShstMatches: any = [];

  for (let i = 0; i < targetMapPathEdges.length; ++i) {
    const { id: targetMapEdgeId } = targetMapPathEdges[i];
    const tmPathEdgeOverlaps = overlaps[i];

    for (let j = 0; j < tmPathEdgeOverlaps.length; ++j) {
      const {
        shstReferenceId,
        tmpEdgeStartDistAlongShstRefPath,
        tmpEdgeEndDistAlongShstRefPath,
        shstFromIntxnDistAlongShstRefChain,
        shstToIntxnDistAlongShstRefChain,
      } = tmPathEdgeOverlaps[j];

      const shstRefLength =
        shstToIntxnDistAlongShstRefChain - shstFromIntxnDistAlongShstRefChain;

      const sectionStart = Math.max(
        tmpEdgeStartDistAlongShstRefPath - shstFromIntxnDistAlongShstRefChain,
        0,
      );

      const sectionEnd = Math.min(
        shstRefLength -
          (shstToIntxnDistAlongShstRefChain - tmpEdgeEndDistAlongShstRefPath),
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
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
  toposortedShstRefs: ToposortedShstRefs,
) {
  const {
    targetMapPathEdges,
    // nearbyTargetMapEdges,
    // targetMapPathShstMatches,
    // vicinitySharedStreetsReferences,
  } = vicinity;

  const { forwardPaths, backwardPaths } = toposortedShstRefs;

  const reversedTargetMapPathEdges = reverseTargetMapPathCoordinates(
    targetMapPathEdges,
  );

  const forwardOverlaps = forwardPaths.filter(_.negate(_.isEmpty)).reduce(
    // @ts-ignore
    (acc, shstRefPath) => acc || getOverlaps(targetMapPathEdges, shstRefPath),
    null,
  );

  const backwardOverlaps = backwardPaths.filter(_.negate(_.isEmpty)).reduce(
    (acc, shstRefPath) =>
      // @ts-ignore
      acc || getOverlaps(reversedTargetMapPathEdges, shstRefPath),
    null,
  );

  const forward =
    forwardOverlaps &&
    overlapsToChosenShstMatches(
      targetMapPathEdges,
      // @ts-ignore
      forwardOverlaps.targetMapPathShstReferenceOverlaps,
      true,
    );
  const backward =
    backwardOverlaps &&
    overlapsToChosenShstMatches(
      targetMapPathEdges,
      // @ts-ignore
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
