import * as turf from '@turf/turf';
import _ from 'lodash';
import KDBush from 'kdbush';
import GeoKDbush from 'geokdbush';

import { SharedStreetsReferenceFeature } from '../../domain/types';

type KDBushIntxnRecord = {
  lon: number;
  lat: number;
  shstReference: SharedStreetsReferenceFeature;
};

export type ShstReferenceFilterFunction = (
  shstReference: SharedStreetsReferenceFeature,
) => boolean;

function shstReferencesAround(
  index: KDBush<KDBushIntxnRecord>,
  longitude: number,
  latitude: number,
  maxResults?: number,
  maxDistance?: number,
  shstReferencesFilterFn?: ShstReferenceFilterFunction,
) {
  const filterFn =
    shstReferencesFilterFn &&
    ((inxtnRec: KDBushIntxnRecord) =>
      shstReferencesFilterFn(inxtnRec.shstReference));

  const nearestShstRefs = GeoKDbush.around(
    index,
    longitude,
    latitude,
    maxResults,
    maxDistance,
    filterFn,
  ).map(({ shstReference }) => shstReference);

  return nearestShstRefs;
}

type ShstIntersectionGeospatialSearchFunction = (
  longitude: number,
  latitude: number,
  maxResults?: number,
  maxDistance?: number,
  shstReferencesFilterFn?: ShstReferenceFilterFunction,
) => SharedStreetsReferenceFeature[];

export default class ShstIntersectionsGeospatialIndex {
  shstReferencesFromAround: ShstIntersectionGeospatialSearchFunction;

  shstReferencesToAround: ShstIntersectionGeospatialSearchFunction;

  constructor(shstReferences: SharedStreetsReferenceFeature[]) {
    const fromIntxnCoords: KDBushIntxnRecord[] = [];
    const toIntxnCoords: KDBushIntxnRecord[] = [];

    for (let i = 0; i < shstReferences.length; ++i) {
      const shstReference = shstReferences[i];

      const shstRefCoords = turf.getCoords(shstReference);

      const [fromLon, fromLat] = _.first(shstRefCoords);

      fromIntxnCoords.push({ lon: fromLon, lat: fromLat, shstReference });

      const [toLon, toLat] = _.last(shstRefCoords);

      toIntxnCoords.push({ lon: toLon, lat: toLat, shstReference });
    }

    const fromIntxnsKDBush = new KDBush(
      fromIntxnCoords,
      ({ lon }) => lon,
      ({ lat }) => lat,
    );

    this.shstReferencesFromAround = shstReferencesAround.bind(
      null,
      fromIntxnsKDBush,
    );

    const toIntxnsKDBush = new KDBush(
      toIntxnCoords,
      ({ lon }) => lon,
      ({ lat }) => lat,
    );

    this.shstReferencesToAround = shstReferencesAround.bind(
      null,
      toIntxnsKDBush,
    );
  }
}
