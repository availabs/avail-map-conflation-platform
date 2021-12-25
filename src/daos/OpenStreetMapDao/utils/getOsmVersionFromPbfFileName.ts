import { basename } from 'path';

import validateOsmVersion from './validateOsmVersion';

export default function getOsmVersionFromPbfFileName(osmPbfFile: string) {
  const b = basename(osmPbfFile);

  if (!/\.osm\.pbf$/.test(b)) {
    return null;
  }

  const osmVersion = b.replace(/\.osm\.pbf$/, '');

  return validateOsmVersion(osmVersion) ? osmVersion : null;
}
