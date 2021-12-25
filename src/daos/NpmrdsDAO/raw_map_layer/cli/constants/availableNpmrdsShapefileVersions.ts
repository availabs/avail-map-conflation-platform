import { existsSync, readdirSync } from 'fs';

import npmrdsInputDirectory from './npmrdsInputDirectory';

import getNpmrdsShapefileVersionFromZipPath from '../utils/getNpmrdsShapefileVersionFromZipPath';

export default existsSync(npmrdsInputDirectory)
  ? readdirSync(npmrdsInputDirectory)
      .map(getNpmrdsShapefileVersionFromZipPath)
      .filter((v) => v)
  : [];
