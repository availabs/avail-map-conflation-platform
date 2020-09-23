/* eslint-disable no-restricted-syntax, no-param-reassign */

import * as GeoJSON from '@types/geojson';

export function makeStopsIterator(): Generator<GeoJSON.Point, void, unknown>;

export function makeShapesIterator(): Generator<
  GeoJSON.LineString,
  void,
  unknown
>;

export function makeShapesWithStopsIterator(): Generator<
  {
    shape: GeoJSON.LineString;
    stops: GeoJSON.Point[];
  },
  void,
  unknown
>;
