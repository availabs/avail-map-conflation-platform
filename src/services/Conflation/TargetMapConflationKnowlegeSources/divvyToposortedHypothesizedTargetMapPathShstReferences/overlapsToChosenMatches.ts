import * as turf from '@turf/turf';
import _ from 'lodash';

import { getGeometriesConcaveHull } from '../../../../utils/gis/hulls';

import {
  TargetMapPathEdgeFeatures,
  ReversedTargetMapPathEdgeFeatures,
  ChosenMatchMetadata,
  SharedStreetsReferenceId,
  SharedStreetsReferenceFeature,
} from '../../domain/types';

function overlapsToChosenMatches(
  isForward: boolean,
  targetMapPathEdges:
    | TargetMapPathEdgeFeatures
    | ReversedTargetMapPathEdgeFeatures,
  overlaps: any,
  chosenMatchSharedStreetsReferencesById: Record<
    SharedStreetsReferenceId,
    SharedStreetsReferenceFeature
  >,
): ChosenMatchMetadata[] {
  const chosenMatches: ChosenMatchMetadata[] = [];

  for (
    let targetMapPathEdgeIdx = 0;
    targetMapPathEdgeIdx < targetMapPathEdges.length;
    ++targetMapPathEdgeIdx
  ) {
    const targetMapPathEdge = targetMapPathEdges[targetMapPathEdgeIdx];

    const {
      id: targetMapEdgeId,
      properties: { targetMapId, targetMapEdgeLength, targetMapPathId },
    } = targetMapPathEdge;

    const tmPathEdgeOverlaps = overlaps[targetMapPathEdgeIdx];

    if (tmPathEdgeOverlaps.length === 0) {
      // TODO: Investigate why this happens.
      continue;
    }

    const {
      tmpEdgeStartDistAlongShstRefPath: edgeStartAlongPath,
    } = tmPathEdgeOverlaps[0];

    const {
      tmpEdgeEndDistAlongShstRefPath: edgeEndDistAlongPath,
    } = tmPathEdgeOverlaps[tmPathEdgeOverlaps.length - 1];

    const edgeChosenMatchesTotalLength =
      edgeEndDistAlongPath - edgeStartAlongPath;

    const lengthRatio = targetMapEdgeLength / edgeChosenMatchesTotalLength;

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

      // How far into the ShstReference does the TargetMapPathEdge start?
      const sectionStart = Math.max(
        tmpEdgeStartDistAlongShstRefPath - shstFromIntxnDistAlongShstRefChain,
        0,
      );

      const sectionEnd = Math.min(
        shstRefLength -
          (shstToIntxnDistAlongShstRefChain - tmpEdgeEndDistAlongShstRefPath),
        shstRefLength,
      );

      // ??? Why overwriting? Concerned about NonEulerian paths? ???
      //   Why would a ShstReference reoccur in the ChosenMatchPath otherwise?
      if (chosenMatchesByShstRef[shstReferenceId]) {
        console.error();
        console.error(
          JSON.stringify(
            {
              msg: '=== Revisiting ShstReference IN ChosenMatches ===',
              targetMapPathId,
              targetMapPathEdgeIdx,
            },
            null,
            4,
          ),
        );
        console.error();

        chosenMatchesByShstRef[shstReferenceId].sectionStart = Math.min(
          chosenMatchesByShstRef[shstReferenceId].sectionStart,
          sectionStart,
        );

        chosenMatchesByShstRef[shstReferenceId].sectionEnd = Math.max(
          chosenMatchesByShstRef[shstReferenceId].sectionEnd,
          sectionEnd,
        );
      } else {
        // @ts-ignore
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

    const targetMapPathEdgeChosenMatches = Object.values(
      chosenMatchesByShstRef,
    ).sort((a, b) => a.targetMapEdgeShstMatchIdx - b.targetMapEdgeShstMatchIdx);

    let alongEdgeStart = 0;
    for (let i = 0; i < targetMapPathEdgeChosenMatches.length; ++i) {
      const chosenMatch = targetMapPathEdgeChosenMatches[i];
      const { shstReferenceId, sectionStart, sectionEnd } = chosenMatch;

      const shstRefSectionLength = sectionEnd - sectionStart;

      const alongEdgeEnd = alongEdgeStart + shstRefSectionLength * lengthRatio;

      chosenMatch.alongEdgeStart = alongEdgeStart;
      chosenMatch.alongEdgeEnd = alongEdgeEnd;

      if (alongEdgeEnd - alongEdgeStart > 0) {
        try {
          // @ts-ignore
          const edge: turf.LineString =
            turf.getType(targetMapPathEdge) === 'LineString'
              ? targetMapPathEdge
              : // FIXME: Brutish Union of the MultiLineString
                turf.lineString(
                  _(turf.getCoords(targetMapPathEdge))
                    .flattenDeep()
                    .chunk(2)
                    .value(),
                );

          const edgeSegment = turf.lineSliceAlong(
            edge,
            alongEdgeStart,
            alongEdgeEnd,
          );

          const shstReference =
            chosenMatchSharedStreetsReferencesById[shstReferenceId];

          const chosenMatchSegment = turf.lineSliceAlong(
            shstReference,
            sectionStart,
            sectionEnd,
          );

          const hull = getGeometriesConcaveHull([
            // @ts-ignore
            edgeSegment,
            // @ts-ignore
            chosenMatchSegment,
          ]);

          const hullArea = turf.area(hull) / (1000 * 1000); // m² to km²

          // FIXME: There's a ton of edgecases where this formula would fail (Rotaries)
          chosenMatch.avgDevianceKm = hullArea / shstRefSectionLength;
        } catch (err) {
          chosenMatch.avgDevianceKm = null;
        }
      } else {
        chosenMatch.avgDevianceKm = null;
      }

      alongEdgeStart = alongEdgeEnd;
    }

    chosenMatches.push(...targetMapPathEdgeChosenMatches);
  }

  return chosenMatches;
}

export const forwardOverlapsToChosenMatches: (
  targetMapPathEdges: TargetMapPathEdgeFeatures,
  overlaps: any,
  chosenMatchSharedStreetsReferencesById: Record<
    SharedStreetsReferenceId,
    SharedStreetsReferenceFeature
  >,
) => ChosenMatchMetadata[] = overlapsToChosenMatches.bind(null, true);

export const backwardOverlapsToChosenMatches: (
  reversedTargetMapPathEdges: ReversedTargetMapPathEdgeFeatures,
  overlaps: any,
  chosenMatchSharedStreetsReferencesById: Record<
    SharedStreetsReferenceId,
    SharedStreetsReferenceFeature
  >,
) => ChosenMatchMetadata[] = overlapsToChosenMatches.bind(null, false);
