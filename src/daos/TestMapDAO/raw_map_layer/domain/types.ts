import * as turf from '@turf/turf';

import {
  SharedStreetsReferenceId,
  SharedStreetsRoadClass,
  SharedStreetsIntersectionId,
} from '../../../SourceMapDao/domain/types';

export interface TestMapFeatureProperties {
  shstReferenceId: SharedStreetsReferenceId;
  fromIntersectionId: SharedStreetsIntersectionId;
  toIntersectionId: SharedStreetsIntersectionId;
  networkLevel: SharedStreetsRoadClass;
  isPrimary: boolean;
  roadName: string;
  routeNumber: string;
  pathId: string;
}

export interface TestMapFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  id: string;
  properties: TestMapFeatureProperties;
}
