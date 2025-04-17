/*
  Simple wrapper around OSRM matching service.
    See: 
          * https://github.com/Project-OSRM/node-osrm/blob/master/docs/api.md#match
          * https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md#match-service

  Any transformations of the input/output should happen in another module.
*/

import { existsSync } from 'fs';
import { join } from 'path';

import OSRM, { MatchOptions, MatchResults } from 'osrm';

import _ from 'lodash';
import * as turf from '@turf/turf';

export default class OsrmMatcher {
  private readonly osrm: OSRM;

  constructor(private readonly osrmFileSetDir: string) {
    const osrmFile = join(this.osrmFileSetDir, 'osm.osrm');

    if (!existsSync(osrmFile)) {
      throw new Error('OSRM toolchain has not been run.');
    }

    // https://github.com/Project-OSRM/osrm-backend/blob/HEAD/docs/nodejs/api.md
    // return new OSRM({ path: osrmFile, algorithm: 'MLD' });
    this.osrm = new OSRM({ path: osrmFile, algorithm: 'CH' });
  }

  match(
    feature: turf.Feature<turf.LineString>,
    matchOptions: MatchOptions = {},
  ): Promise<MatchResults> {
    const coordinates = turf
      .getCoords(feature)
      .filter((coord, idx, arr) => !_.isEqual(coord, arr[idx - 1]));

    return new Promise((resolve, reject) =>
      this.osrm.match(
        {
          // Defaults
          coordinates,
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

          resolve(result);
        },
      ),
    );
  }

  static extractOsmNodeIdsSequenceFromMatchResult(result: MatchResults) {
    if (!result?.matchings?.length) {
      return null;
    }

    const { matchings } = result;

    const a: number[][][] = matchings.map(({ legs }) =>
      legs.map(({ annotation: { nodes } }) => nodes),
    );

    const b = _.flatten(a);

    const c = b.reduce((acc, cur, idx) => {
      const next = b[idx + 1];

      if (!next) {
        acc.push(...cur);
        return acc;
      }

      const nextStartNode = next[0];

      const x = cur.lastIndexOf(nextStartNode);

      if (x === -1) {
        acc.push(...cur);
        return acc;
      }

      const invariantHolds = cur.slice(x).every((n, i) => n === next[i]);

      if (!invariantHolds) {
        console.log(JSON.stringify({ cur, next, x }, null, 4));
        throw new Error('INVARIANT BROKEN: curLast2 !== nextFirst2');
      }

      acc.push(...cur.slice(0, idx));

      return acc;
    }, []);

    return c;
  }
}
