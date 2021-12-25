import { existsSync, readdirSync } from 'fs';

import npmrdsInputDirectory from './npmrdsInputDirectory';

import getTmcIdentifcationVersionFromCsvGzipPath from '../utils/getTmcIdentifcationVersionFromCsvGzipPath';

export default existsSync(npmrdsInputDirectory)
  ? readdirSync(npmrdsInputDirectory)
      .map(getTmcIdentifcationVersionFromCsvGzipPath)
      .filter((v) => v)
  : [];
