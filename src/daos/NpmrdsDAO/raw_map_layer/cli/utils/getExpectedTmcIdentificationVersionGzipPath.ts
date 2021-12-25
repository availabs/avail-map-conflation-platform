import { join } from 'path';

import npmrdsInputDirectory from '../constants/npmrdsInputDirectory';

import { TmcIdentificationVersion } from '../../domain/types';

export default function getExpectedTmcIdentificationVersionGzipPath(
  tmcIdentificationVersion: TmcIdentificationVersion,
) {
  return join(npmrdsInputDirectory, `${tmcIdentificationVersion}.csv.gz`);
}
