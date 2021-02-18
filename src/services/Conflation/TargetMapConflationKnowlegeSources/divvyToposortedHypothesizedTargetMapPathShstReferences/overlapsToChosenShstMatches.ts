import {
  TargetMapPathEdgeFeatures,
  ReversedTargetMapPathEdgeFeatures,
  ChosenMatchMetadata,
  SharedStreetsReferenceId,
} from '../../domain/types';

function overlapsToChosenShstMatches(
  isForward: boolean,
  targetMapPathEdges:
    | TargetMapPathEdgeFeatures
    | ReversedTargetMapPathEdgeFeatures,
  overlaps: any,
): ChosenMatchMetadata[] {
  const chosenShstMatches: ChosenMatchMetadata[] = [];

  for (let i = 0; i < targetMapPathEdges.length; ++i) {
    const {
      id: targetMapEdgeId,
      properties: { targetMapId },
    } = targetMapPathEdges[i];

    const tmPathEdgeOverlaps = overlaps[i];

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
          targetMapEdgeId,
          isForward,
          targetMapEdgeShstMatchIdx: targetMapEdgeShstMatchIdx++,
          shstReferenceId,
          sectionStart,
          sectionEnd,
        };
      }
    }

    chosenShstMatches.push(...Object.values(chosenMatchesByShstRef));
  }

  return chosenShstMatches;
}

export const forwardOverlapsToChosenShstMatches: (
  targetMapPathEdges: TargetMapPathEdgeFeatures,
  overlaps: any,
) => ChosenMatchMetadata[] = overlapsToChosenShstMatches.bind(null, true);

export const backwardOverlapsToChosenShstMatches: (
  reversedTargetMapPathEdges: ReversedTargetMapPathEdgeFeatures,
  overlaps: any,
) => ChosenMatchMetadata[] = overlapsToChosenShstMatches.bind(null, false);
