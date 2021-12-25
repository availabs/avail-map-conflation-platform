import { writeFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

export default (
  features: turf.Feature<turf.Point | turf.LineString | turf.MultiLineString>[],
  fileName: string,
) =>
  writeFileSync(
    join(__dirname, '../../../../logs', `${fileName}.geojson`),
    JSON.stringify(turf.featureCollection(_.flattenDeep(features))),
  );
