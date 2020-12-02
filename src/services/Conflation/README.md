# Conflation Service

## Overview

TODO: TL;DR

## DOMAIN

### PathLineStrings

TODO: Define These

## MatchesChooser

### computeSubGraphComponentsTraversals

```typescript
// Input
//   The targetMapPathMatches data structure:
//     [
//       {
//         targetMapPathEdge: <GeoJSON feature for the GTFS shape segment.>,
//         shstMatches: [...shst match GeoJSON features for the GTFS shape segment.]
//       },
//       ...
//     ]
//
// Returns a single heuristically-chosen topologically-sorted per-component path
//   for each TargetMap Edge through its suggested Shst Matches graph.
//
// FIXME: This function MUST return ALL possible traversals, not a chosen one.
//        It is the role of the more sophisticated find*Paths algorithms to choose.
export default function computeSubGraphComponentsTraversals(
  targetMapPathMatches: TargetMapPathMatches,
) {
  if (!targetMapPathMatches?.length) {
    return null;
  }

  const subGraphs = buildShstMatchSubGraphsPerGtfsShapeSegment(
    targetMapPathMatches,
  );
...

  return subGraphs.map((subGraph, targetMapPathIdx) => {
    const pathLineStrings = createPathLineStrings(
      targetMapPathEdge,
      subGraph,
      shstMatchesById,
    );

    const pathsPairwiseCospatiality = getPathsPairwiseCospatiality(
      pathLineStrings,
    );

    return {
      targetMapPathEdge,
      pathLineStrings,
      pathsPairwiseCospatiality: !_.isEmpty(pathsPairwiseCospatiality)
        ? pathsPairwiseCospatiality
        : null,
    };
}
```

### createPathLineStrings

```typescript
export default function createPathLineStrings(
  targetMapPathEdge,
  subGraph,
  shstMatchesById,
) {
  // Toposorted ShstMatches for each GTFS shape segment
  //   Three dimensional array:
  //     dim-1: components
  //       dim-2: component sources
  //         dim-3: component sinks
  //
  //   In each component, every possible (source, sink) pair path
  //
  // NOTE: edgeWeight is calculated in
  //       buildShstMatchSubGraphsPerGtfsShapeSegment
  //       using questionable assumptions.
  const source2SinkPaths = subGraphComponentsSourcesAndSinks.map(
    ({ componentSources, componentSinks }) =>
  ...
  );
...
```

### chooseTargetMapPathShstMatches

*MODULE PURPOSE*: Cherry-pick the best shstMatches across the TargetMap Path.

#### TargetMap Path ShstMatches Selection Algorithm

Here, we use the known topological properties of TargetMap Paths
  to choose the optimal Shst Matches for the Path's constituent Edges.

Within this module, the chosen matches for each Edge have already been merged
  by the computeSubGraphComponentsTraversals module.

Currently, the decision making logic designates
  as the Ground Truths for further deductions
  TargetMap Edges with a single ShstMatches Path
  that spans most of the TargetMap Edge.
  **TODO**: Add Frechet to this criteria as well.

```text
▾ MatchesChooser/
  ▾ chooseTargetMapPathShstMatches/
      constants.ts
      findAxiomaticPaths.ts
      findNonAxiomaticPaths.ts
      index.ts
```

##### index.ts

```typescript
export default function chooseTargetMapPathShstMatches({
  targetMapPathMatches,
  subGraphComponentsTraversals,
}) {
...
```

Uses subGraphComponentsTraversals output to generate the aggregatedSummary datastructure.

```typescript
{
  targetMapPathEdge,
  targetMapEdgeLength,
  shstMatches,
  pathLineStrings,
  pathLengths,
  segPathLengthRatios,
  targetMapPathId,
  targetMapPathIdx,
  numPaths,
}
```

The aggregatedSummary datastructure is, in turn used by
  findAxiomaticPaths and findNonAxiomaticPaths to choose
  the optimal set of Shst Matches for each TargetMap Edge.

##### findAxiomaticPaths

Choose the matches that maximize sequentiality across the TargetMap Path using

* the data in aggregatedSummary
* [utils/gis/getSequentiality](../../utils/gis/getSequentiality.js)

```typescript
export default function findAxiomaticPaths({
  chosenPaths,
  aggregatedSummary,
  pathLengthThld,
  segPathLengthDiffRatioThld,
  gapDistThld,
}) {
...
      const summary = aggregatedSummary[i];

      if (!summary) {
        return acc;
      }

      const { pathLengths, segPathLengthRatios, pathLineStrings } = summary;
...
        if (!_.isEmpty(predecessorChosenPaths)) {
          const other = _.last(predecessorChosenPaths);
          const { gapDist } = getSequentiality(other, path);

          if (gapDist > gapDistThld) {
            return acc2;
          }
        }
...
```

###### findNonAxiomaticPaths

Choose the matches that maximize cospatiality across the TargetMap Path using

* the data in aggregatedSummary
* [utils/gis/getCospatialityOfLinestrings](../../utils/gis/getCospatialityOfLinestrings.js)

```typescript
export default function findNonAxiomaticPaths({
  chosenPaths,
  aggregatedSummary,
}) {
...
      const cospatialities = _.range(0, features.length).map(() =>
        _.range(0, features.length).map(() => []),
      );

      for (let i = 0; i < features.length; ++i) {
        const S = features[i];

        cospatialities[i][i] = null;

        for (let j = i + 1; j < features.length; ++j) {
          const T = features[j];

          const cospat = getCospatialityOfLinestrings(S, T);

          cospatialities[i][j] = cospat !== null ? { self: 'S', cospat } : null;
          cospatialities[j][i] = cospat !== null ? { self: 'T', cospat } : null;
        }
      }
...
```
