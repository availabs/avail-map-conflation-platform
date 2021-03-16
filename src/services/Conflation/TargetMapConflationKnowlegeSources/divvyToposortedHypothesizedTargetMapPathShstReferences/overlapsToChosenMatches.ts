import {
  TargetMapPathEdgeFeatures,
  ReversedTargetMapPathEdgeFeatures,
  ChosenMatchMetadata,
  SharedStreetsReferenceId,
} from '../../domain/types';

function overlapsToChosenMatches(
  isForward: boolean,
  targetMapPathEdges:
    | TargetMapPathEdgeFeatures
    | ReversedTargetMapPathEdgeFeatures,
  overlaps: any,
): ChosenMatchMetadata[] {
  const chosenMatches: ChosenMatchMetadata[] = [];

  for (
    let targetMapPathEdgeIdx = 0;
    targetMapPathEdgeIdx < targetMapPathEdges.length;
    ++targetMapPathEdgeIdx
  ) {
    const {
      id: targetMapEdgeId,
      properties: { targetMapId, targetMapPathId },
    } = targetMapPathEdges[targetMapPathEdgeIdx];

    const tmPathEdgeOverlaps = overlaps[targetMapPathEdgeIdx];

    const chosenMatchesByShstRef: Record<
      SharedStreetsReferenceId,
      ChosenMatchMetadata
    > = {};

    let targetMapEdgeShstMatchIdx = 0;

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

      if (chosenMatchesByShstRef[shstReferenceId]) {
        chosenMatchesByShstRef[shstReferenceId].sectionStart = Math.min(
          chosenMatchesByShstRef[shstReferenceId].sectionStart,
          sectionStart,
        );

        chosenMatchesByShstRef[shstReferenceId].sectionStart = Math.max(
          chosenMatchesByShstRef[shstReferenceId].sectionEnd,
          sectionEnd,
        );
      } else {
        chosenMatchesByShstRef[shstReferenceId] = {
          targetMapId,
          targetMapPathId,
          targetMapPathEdgeIdx,
          targetMapEdgeId,
          isForward,
          targetMapEdgeShstMatchIdx: targetMapEdgeShstMatchIdx++,
          shstReferenceId,
          sectionStart,
          sectionEnd,
        };
      }
    }

    chosenMatches.push(...Object.values(chosenMatchesByShstRef));
  }

  return chosenMatches;
}

export const forwardOverlapsToChosenMatches: (
  targetMapPathEdges: TargetMapPathEdgeFeatures,
  overlaps: any,
) => ChosenMatchMetadata[] = overlapsToChosenMatches.bind(null, true);

export const backwardOverlapsToChosenMatches: (
  reversedTargetMapPathEdges: ReversedTargetMapPathEdgeFeatures,
  overlaps: any,
) => ChosenMatchMetadata[] = overlapsToChosenMatches.bind(null, false);
