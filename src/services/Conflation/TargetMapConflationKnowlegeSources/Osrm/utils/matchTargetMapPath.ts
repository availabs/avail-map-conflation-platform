import * as turf from '@turf/turf';
import _ from 'lodash';

import SourceMapDao from '../../../../../daos/SourceMapDao';

import { SharedStreetsReferenceFeature } from '../../../../../daos/SourceMapDao/domain/types';

import { getOsmMatchNodes } from '../../../../Osrm';

import { TargetMapPathEdgeFeatures } from '../../../../../utils/TargetMapDatabases/TargetMapDAO';

// const MIN_CONFIDENCE = 0.5;
// const MIN_CONFIDENCE = Number.EPSILON;
// const MIN_CONFIDENCE = 0;
const MIN_CONFIDENCE = 0.005;
// const MIN_CONFIDENCE = 0.9;

export function getMergedCoordinatesForTargetMapPathEdges(
  targetMapPathEdges: TargetMapPathEdgeFeatures,
) {
  const mergedCoords: [number, number][] = [];
  const waypoints: number[] = [];

  for (let i = 0; i < targetMapPathEdges.length; ++i) {
    // @ts-ignore
    const coords: [number, number][] = _(turf.getCoords(targetMapPathEdges[i]))
      .flattenDeep()
      .chunk(2)
      .filter((coord, j, col) => !_.isEqual(coord, col[j - 1]))
      .value();

    if (_.isEqual(_.last(mergedCoords), _.first(coords))) {
      mergedCoords.push(...coords.slice(1));
    } else {
      waypoints.push(mergedCoords.length);

      mergedCoords.push(...coords);
    }

    waypoints.push(mergedCoords.length - 1);
  }

  return { mergedCoords, waypoints };
}

export async function getShstReferencesForTargetMapPathEdges(
  targetMapPathEdges: TargetMapPathEdgeFeatures,
) {
  try {
    const {
      mergedCoords,
      waypoints,
    } = getMergedCoordinatesForTargetMapPathEdges(targetMapPathEdges);

    const mergedPath = turf.lineString(mergedCoords);

    const shstReferences: SharedStreetsReferenceFeature[][] = [];

    const osmNodes = await getOsmMatchNodes(
      mergedPath,
      { waypoints },
      MIN_CONFIDENCE,
    );

    console.log(JSON.stringify({ osmNodes }, null, 4).slice(0, 500));

    const withWayPoints = osmNodes?.length
      ? // For each leg (determined by waypoints)
        osmNodes
          .map(({ legNodes }) =>
            SourceMapDao.getShstReferencesForOsmNodeSequences(
              _.flattenDeep(legNodes),
            )
              ?.filter(Boolean)
              .map((f) => {
                f.properties.osrmMatchType = 'WITH_WAYPOINTS';
                return f;
              }),
          )
          .filter(Boolean)
      : [];

    shstReferences.push(...withWayPoints);

    const unionedEdges = targetMapPathEdges.map((edge) =>
      turf.lineString(
        _(turf.getCoords(edge))
          .flattenDeep()
          .chunk(2)
          .filter((coord, i, arr) => !_.isEqual(coord, arr[i - 1]))
          .value(),
      ),
    );

    const osmNodesByEdge = _.flatten(
      await Promise.all(
        unionedEdges.map((edge) =>
          getOsmMatchNodes(edge, null, MIN_CONFIDENCE),
        ),
      ),
    ).filter(Boolean);

    console.log(JSON.stringify({ osmNodesByEdge }, null, 4).slice(0, 500));

    const byEdge = osmNodesByEdge?.length
      ? osmNodesByEdge
          .map(({ legNodes }) =>
            SourceMapDao.getShstReferencesForOsmNodeSequences(
              _.flattenDeep(legNodes),
            )
              ?.filter(Boolean)
              .map((f) => {
                f.properties.osrmMatchType = 'BY_EDGE';
                return f;
              }),
          )
          .filter(Boolean)
      : [];

    shstReferences.push(...byEdge);

    const osmNodesNoWayPts = await getOsmMatchNodes(
      mergedPath,
      null,
      MIN_CONFIDENCE,
    );

    // FIXME: Need to DIVVY these
    const noWayPoints = osmNodesNoWayPts?.length
      ? SourceMapDao.getShstReferencesForOsmNodeSequences(
          _.flattenDeep(osmNodesNoWayPts.map(({ legNodes }) => legNodes)),
        )
          ?.filter(Boolean)
          .map((f) => {
            f.properties.osrmMatchType = 'NO_WAYPOINTS';
            return f;
          })
      : [];

    shstReferences.push(noWayPoints);

    return shstReferences.length ? shstReferences : null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export function reverseTargetMapPathEdges(
  targetMapPathEdges: TargetMapPathEdgeFeatures,
) {
  const reversed = _.cloneDeep(targetMapPathEdges).reverse();

  reversed.forEach((edge) => {
    edge.geometry.coordinates.reverse();

    if (turf.getType(edge) === 'MultiLineString') {
      edge.geometry.coordinates.forEach(
        // @ts-ignore
        (coords: [number, number][]) => coords.reverse(),
      );
    }
  });

  return reversed;
}

export default async function matchTargetMapPathEdges(
  targetMapPathEdges: TargetMapPathEdgeFeatures,
) {
  const forward = await getShstReferencesForTargetMapPathEdges(
    targetMapPathEdges,
  );

  _.flattenDeep(forward)
    .filter(Boolean)
    .forEach((e) => {
      e.properties.matchDirection = 'fwd';
    });

  /*
  const backward = await getShstReferencesForTargetMapPathEdges(
    reverseTargetMapPathEdges(targetMapPathEdges),
  );

  _.flattenDeep(backward)
    .filter(Boolean)
    .forEach((e) => {
      e.properties.matchDirection = 'bwd';
    });
    */

  const backward = null;

  return { forward, backward };
}
