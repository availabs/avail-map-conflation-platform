import { join } from 'path';

import nysRisInputDirectory from '../constants/nysRisInputDirectory';

import { NysRisVersion } from '../../domain/types';

export default function getExpectedNysRisVersionZipPath(
  nysRisVersion: NysRisVersion,
) {
  return join(nysRisInputDirectory, `${nysRisVersion}.gdb.zip`);
}
