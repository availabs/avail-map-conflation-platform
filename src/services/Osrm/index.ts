/* eslint-disable no-await-in-loop, no-continue */

/*
    TODO:
            TargetMaps could have custom OSRM profiles.
            Loading a target map could entail creating customized OSRM files
            This module can become a class.
              The constructor would take the path to the custom OSRM files.

            This may become a necessity when working with the GTFS routes
              Because
                0. GTFS routes are less like Dijkstra and more like traveling salesman.
                1. GTFS routes regularly use parking lots.
                2. Height restrictions.
*/

import { existsSync } from 'fs';
import { join } from 'path';

import OSRM, {
  MatchOptions,
  MatchResults,
  RouteOptions,
  RouteResults,
} from 'osrm';
import * as turf from '@turf/turf';
import memoizeOne from 'memoize-one';
import _ from 'lodash';

import outputDirectory from '../../constants/outputDirectory';

const osrmDataDir = join(outputDirectory, 'osrm');

// https://github.com/sharedstreets/sharedstreets-js/blob/98f8b78d0107046ed2ac1f681cff11eb5a356474/src/graph.ts#L746
const DEFAULT_CONFIDENCE_GTE = Number.EPSILON;

const getOSRM = memoizeOne(() => {
  const osrmFile = join(osrmDataDir, 'osm.osrm');

  if (!existsSync(osrmFile)) {
    throw new Error('OSRM toolchain has not been run.');
  }

  // https://github.com/Project-OSRM/osrm-backend/blob/HEAD/docs/nodejs/api.md
  // return new OSRM({ path: osrmFile, algorithm: 'MLD' });
  return new OSRM({ path: osrmFile, algorithm: 'CH' });
});

export function getOsrmMatch(
  feature: turf.Feature<turf.LineString>,
  matchOptions: MatchOptions = {},
): Promise<MatchResults> {
  return new Promise((resolve, reject) =>
    getOSRM().match(
      {
        // Defaults
        coordinates: turf.getCoords(feature),
        geometries: 'geojson',
        overview: 'full',
        snapping: 'any',
        annotations: ['nodes'],
        tidy: true,

        // Overrides
        ...matchOptions,
      },
      (err, result: MatchResults) => {
        if (err) {
          reject(err);
        }

        // console.log(JSON.stringify({ matchResult: result }, null, 4));
        resolve(result);
      },
    ),
  );
}

export async function getParsedOsrmMatch(
  feature: turf.Feature<turf.LineString>,
  matchOptions?: MatchOptions,
) {
  try {
    const result = await getOsrmMatch(feature, matchOptions);

    const { matchings } = result;

    const matchCoords = _(matchings)
      .map('geometry.coordinates')
      .flattenDeep()
      .chunk(2)
      .filter((coord, i, coords) => !_.isEqual(coord, coords[i - 1]))
      .value();

    const newFeature =
      matchCoords.length > 1 ? turf.lineString(matchCoords) : null;

    return newFeature;
  } catch (err2) {
    // console.error(err2);
    return null;
  }
}

export async function getOsmMatchNodes(
  feature: turf.Feature<turf.LineString>,
  matchOptions?: MatchOptions | null,
  confidenceGTE: number = DEFAULT_CONFIDENCE_GTE,
) {
  try {
    const result = await getOsrmMatch(feature, {
      ...(matchOptions || {}),
      overview: 'false',
    });

    // console.log(JSON.stringify({ result }, null, 4));

    const { matchings } = result;

    const allNodes: { confidence: number; legNodes: number[][] }[] = _.flatten(
      matchings
        .filter(({ confidence }) => {
          // console.error(JSON.stringify({ confidence }, null, 4));
          return confidence >= confidenceGTE;
        })
        .map(({ confidence, legs }) => {
          const legNodes = legs.map(({ annotation: { nodes } }) => nodes);

          return { confidence, legNodes };
        }),
    );

    return allNodes;
  } catch (err2) {
    // console.error(err2);
    return null;
  }
}

export function getOsrmRoute(
  feature: turf.Feature<turf.LineString>,
  routeOptions: RouteOptions = {},
): Promise<RouteResults> {
  return new Promise((resolve, reject) =>
    getOSRM().route(
      {
        alternatives: false,
        steps: false,
        coordinates: turf.getCoords(feature),
        geometries: 'geojson',
        continue_straight: true,
        overview: 'false',
        tidy: false,
        snapping: 'any',
        annotations: ['nodes'],
        skip_waypoints: false,
        ...routeOptions,
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }

        return resolve(result);
      },
    ),
  );
}

export async function getParsedOsrmRoute(
  feature: turf.Feature<turf.LineString>,
  routeOptions?: RouteOptions,
) {
  try {
    const result = await getOsrmRoute(feature, {
      ...routeOptions,
      overview: 'full',
    });

    const { routes } = result;

    // console.log(JSON.stringify(result, null, 4));

    const allCoordinates: [number, number][] = [];

    routes.forEach((route) => {
      const {
        geometry: { coordinates },
      } = route;

      allCoordinates.push(...coordinates);
    });

    const newFeature = turf.lineString(
      allCoordinates.filter(
        (coord: [number, number], i: number) =>
          !_.isEqual(coord, allCoordinates[i - 1]),
      ),
    );

    return newFeature;
  } catch (err2) {
    // console.error(err2);
    return null;
  }
}

export async function getOsmNodes(
  feature: turf.Feature<turf.LineString>,
  routeOptions?: RouteOptions,
) {
  try {
    const result = await getOsrmRoute(feature, {
      ...routeOptions,
      overview: 'false',
    });

    const { routes } = result;

    const allNodes: number[][] = _.flatten(
      routes.map((route) =>
        route.legs.map(({ annotation: { nodes } }) => nodes),
      ),
    );

    return allNodes;
  } catch (err2) {
    // console.error(err2);
    return null;
  }
}
