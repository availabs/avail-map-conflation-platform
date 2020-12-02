/* eslint-disable no-continue, no-constant-condition, no-cond-assign */

import * as turf from '@turf/turf';
import _ from 'lodash';

import mergeLineStringsGeospatially from '../../../../utils/gis/mergeLineStringsGeospatially';

export default function mergePathSegmentsGeospatially(S, T) {
  const sShstMatchIds = S.properties.pathDecompositionInfo
    .map(({ id }) => id)
    .filter((id) => id !== null);

  const tShstMatchIds = T.properties.pathDecompositionInfo
    .map(({ id }) => id)
    .filter((id) => id !== null);

  // Can't merge S->T if S & T share shstMatchIds
  if (_.intersection(sShstMatchIds, tShstMatchIds).length > 0) {
    return null;
  }

  const mergeResult = mergeLineStringsGeospatially(S, T);

  if (mergeResult === null) {
    return null;
  }

  const { order, isGap, gapDist, mergedPath } = mergeResult;

  const [A, B] = order;

  const mergedPDI = Array.prototype.concat(
    A.properties.pathDecompositionInfo,
    { id: null, len: gapDist, isGap },
    B.properties.pathDecompositionInfo,
  );

  // NOTE: Shallow copy... therefore only make shallow mutations.
  const properties = {
    ...S.properties,
    ...{ pathDecompositionInfo: mergedPDI },
  };

  mergedPath.properties = properties;

  const {
    properties: { targetMapEdgeLength },
  } = mergedPath;

  const {
    properties: { mergeHistory: aMergeHistory = null },
  } = A;

  const {
    properties: { mergeHistory: bMergeHistory = null },
  } = B;

  const mergeHistory =
    aMergeHistory !== null || bMergeHistory !== null
      ? [[aMergeHistory, bMergeHistory]] // no defensive copies... do not mutate.
      : [];

  mergeHistory.push({
    algo: 'mergePathSegmentsGeospatially',
    shstMatchIds: [
      A.properties.pathDecompositionInfo.map(({ id }) => id),
      B.properties.pathDecompositionInfo.map(({ id }) => id),
    ],
  });

  mergedPath.properties.mergeHistory = mergeHistory;

  // We update the metadata comparing the matches path length to the GTFS Shape Seg length.
  const mergedShstMatchesLength = turf.length(mergedPath);

  const lengthDifference = targetMapEdgeLength - mergedShstMatchesLength;
  const lengthRatio = targetMapEdgeLength / mergedShstMatchesLength;

  Object.assign(mergedPath.properties, {
    mergedShstMatchesLength,
    lengthDifference,
    lengthRatio,
  });

  return mergedPath;
}
