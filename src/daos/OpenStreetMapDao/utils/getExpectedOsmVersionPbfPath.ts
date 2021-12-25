import { join } from 'path';

import osmInputDirectory from '../constants/osmInputDirectory';

import { OsmVersion } from '../domain/types';

export default function getExpectedOsmVersionPbfPath(osmVersion: OsmVersion) {
  return join(osmInputDirectory, `${osmVersion}.osm.pbf`);
}
