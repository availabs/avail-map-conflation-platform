import { join } from 'path';

import npmrdsInputDirectory from '../constants/npmrdsInputDirectory';

import { NpmrdsVersion } from '../../domain/types';

export default function getExpectedNpmrdsShapefileVersionZipPath(
  npmrdsVersion: NpmrdsVersion,
) {
  return join(npmrdsInputDirectory, `${npmrdsVersion}.zip`);
}
