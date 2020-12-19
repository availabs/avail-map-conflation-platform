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
            feature
          FROM ${SOURCE_MAP}.shst_reference_features
          ORDER BY shst_reference_id
        ; `,
    )
    .raw()
    .iterate();

  for (const [featureStr] of shstReferencesIter) {
    const feature = JSON.parse(featureStr);

    yield feature;
  }
}
