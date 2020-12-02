/* eslint-disable no-cond-assign */

import * as turf from '@turf/turf';
import _ from 'lodash';

import { alg as graphAlgs } from 'graphlib';

import unionPathLineStrings from './unionPathLineStrings';

import removeRedundantCoords from './removeRedundantCoords';

export default function createPathLineStrings(
  targetMapPathEdge,
  subGraph,
  shstMatchesById,
) {
  const sources = subGraph.sources();
  const sinks = subGraph.sinks();

  // Note: These could be empty if the subGraph is cyclic
  // FIXME: ??? Are these redundant ???
  const subGraphSources = subGraph.sources();
  const subGraphSinks = subGraph.sinks();

  // [subGraph component][nodes in subGraph component]
  const subGraphComponents = graphAlgs.components(subGraph);

  // The sources and sinks for each segment's subGraph's components
  const subGraphComponentsSourcesAndSinks = subGraphComponents.map(
    (component) => {
      const subSources = _.intersection(component, sources);
      const subSinks = _.intersection(component, sinks);

      // FIXME: ??? Not sure what the intention was here. ???
      //        ??? Essentially, it's filtering out Cycles ???
      const isSourceComponent = subSources.length > 0;
      const isSinkComponent = subSinks.length > 0;

      return {
        componentSources: isSourceComponent
          ? subSources
          : _.intersection(component, subGraphSources),
        componentSinks: isSinkComponent
          ? subSinks
          : _.intersection(component, subGraphSinks),
      };
    },
  );

  // Toposorted ShstMatches for each TargetMap Edge
  //   Three dimensional array:
  //     dim-1: components
  //       dim-2: component sources
  //
  //   In each component, every possible (source, sink) pair path
  //
  // NOTE: edgeWeight is calculated in
  //       buildShstMatchSubGraphsPerGtfsShapeSegment
  //       using questionable assumptions.
  const source2SinkPaths = subGraphComponentsSourcesAndSinks.map(
    ({ componentSources, componentSinks }) =>
      componentSources.map((src) => {
        const paths = graphAlgs.dijkstra(subGraph, src, (e) => {
          const { edgeWeight } = subGraph.edge(e);

          return edgeWeight;
        });

        return componentSinks
          .map((sink) => {
            // If the sink was not reachable from the source,
            //   the source2SinkPath does not exist.
            if (!Number.isFinite(paths[sink].distance)) {
              return null;
            }

            // Build the Matches path from the dijkstra output.
            let s = sink;
            let { predecessor } = paths[sink];
            const path = [sink];
            while (({ predecessor } = paths[s])) {
              if (!predecessor) {
                break;
              }
              path.push(predecessor);
              s = predecessor;
            }

            const p = path.filter((e) => e).reverse();
            return p.length ? p : null;
          })
          .filter((p) => p);
      }),
  );

  const pathLineStrings =
    Array.isArray(source2SinkPaths) &&
    _.flattenDeep(
      source2SinkPaths.map(
        // Each element of the source2SinkPaths 3-dimensional array represents
        //   the "shortest" path through a component for each (source, sink) pair.
        //   For each component (dim-1), we have an array of paths (dim-2)
        //   for each source within the component to each sink (dim-3) in the component.
        (componentSourcesArr) => {
          const targetMapEdgeLength = turf.length(targetMapPathEdge);

          const {
            properties: { targetMapPathId, targetMapPathIdx },
          } = targetMapPathEdge;

          const shstMatchPaths =
            // For each component in the shape segment's shstMatches subGraph
            Array.isArray(componentSourcesArr)
              ? componentSourcesArr.map((componentSinksArr) => {
                  if (
                    !(
                      Array.isArray(componentSinksArr) &&
                      componentSinksArr.length
                    )
                  ) {
                    return null;
                  }

                  const mergedLineStrings = componentSinksArr.map((path) => {
                    const pathSummary = _.flatten(
                      _.tail(path).map((w, path_index) => {
                        const v = path[path_index];
                        const { shstMatch } = subGraph.edge(v, w);

                        const {
                          id,
                          properties: {
                            shstReferenceId,
                            // section: shstReferenceSection,
                          },
                        } = shstMatch;

                        return {
                          id,
                          shstReferenceId,
                          // shstReferenceSection,
                          len: turf.length(shstMatch),
                          coords: turf.getCoords(shstMatch),
                        };
                      }),
                    );

                    const pathCoords = removeRedundantCoords(
                      _.flatten(pathSummary.map(({ coords }) => coords)),
                    );

                    if (pathCoords < 2) {
                      return null;
                    }

                    const pathDecompositionInfo = pathSummary.map((p) =>
                      _.omit(p, 'coords'),
                    );

                    const pathLineString = turf.lineString(pathCoords, {
                      targetMapPathId,
                      targetMapPathIdx,
                      pathDecompositionInfo,
                      targetMapEdgeLength,
                    });

                    const mergedShstMatchesLength = turf.length(pathLineString);

                    const lengthDifference =
                      targetMapEdgeLength - mergedShstMatchesLength;
                    const lengthRatio =
                      targetMapEdgeLength / mergedShstMatchesLength;

                    Object.assign(pathLineString.properties, {
                      mergedShstMatchesLength,
                      lengthDifference,
                      lengthRatio,
                    });

                    return pathLineString;
                  });

                  return mergedLineStrings;
                })
              : null;

          return shstMatchPaths;
        },
      ),
    ).filter((p) => p);

  // MUTATES THE pathLineStrings ARRAY
  unionPathLineStrings(pathLineStrings, shstMatchesById);

  return pathLineStrings;
}
