import { existsSync, readdirSync } from 'fs';

import osmInputDirectory from './osmInputDirectory';

import getOsmVersionFromPbfFileName from '../utils/getOsmVersionFromPbfFileName';

export default existsSync(osmInputDirectory)
  ? readdirSync(osmInputDirectory)
      .map(getOsmVersionFromPbfFileName)
      .filter((v) => v)
  : [];
