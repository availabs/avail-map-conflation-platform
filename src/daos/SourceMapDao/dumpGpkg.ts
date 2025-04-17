/* eslint-disable no-restricted-syntax */

import DbService from '../../services/DbService';

import GeoPackageWriter from '../../services/Conflation/developmentTools/conflationSpatial/utils/GeoPackageWriter';

import { SOURCE_MAP } from '../../constants/databaseSchemaNames';

export default function dumpGpkg() {
  const db = DbService.openConnectionToDb(SOURCE_MAP);

  const gpkgWriter = new GeoPackageWriter('source_map');

  const iter = db
    .prepare(
      `
      SELECT
          feature
        FROM shst_reference_features
    `,
    )
    .pluck()
    .iterate();

  for (const featureStr of iter) {
    const feature = JSON.parse(featureStr);

    gpkgWriter.write(feature);
  }

  gpkgWriter.close();
}

if (require.main === module) {
  dumpGpkg();
}
