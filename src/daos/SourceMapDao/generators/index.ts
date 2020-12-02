/* eslint-disable no-restricted-syntax, import/prefer-default-export */

import * as turf from '@turf/turf';

import db from '../../../services/DbService';

import { SOURCE_MAP } from '../../../constants/databaseSchemaNames';

export function* makeSharedStreetsReferenceFeaturesIterator(): Generator<
  turf.Feature<turf.LineString>
> {
  const shstReferencesIter = db
    .prepare(
      `
        SELECT
            shst_reference_id,
            shst_geometry_id,
            form_of_way,
            is_forward,
            location_references,
            feature,
          FROM ${SOURCE_MAP}.shst_reference_geometries
            INNER JOIN ${SOURCE_MAP}.shst_references_location_references_json
            USING (shst_reference_id)
          ORDER BY shst_geometry_id
        ; `,
    )
    .raw()
    .iterate();

  for (const [
    shstReferenceId,
    geometryId,
    formOfWay,
    isForward,
    locationReferencesStr,
    featureStr,
  ] of shstReferencesIter) {
    const feature = JSON.parse(featureStr);
    const locationReferences = JSON.parse(locationReferencesStr);

    feature.id = shstReferenceId;

    feature.properties = {
      shstReferenceId,
      geometryId,
      formOfWay,
      locationReferences,
    };

    if (!isForward) {
      feature.geometry.coordinates.reverse();
    }

    yield feature;
  }
}
