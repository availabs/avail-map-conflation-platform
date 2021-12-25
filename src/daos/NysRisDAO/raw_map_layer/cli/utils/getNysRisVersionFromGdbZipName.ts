import { basename } from 'path';

import isValidNysRisVersion from '../../utils/isValidNysRisVersion';

export default function getNysRisVersionFromPbfFileName(nysRisPbfFile: string) {
  const b = basename(nysRisPbfFile);

  if (!/\.gdb\.zip$/.test(b)) {
    return null;
  }

  const nysRisVersion = b.replace(/\.gdb\.zip$/, '');

  return isValidNysRisVersion(nysRisVersion) ? nysRisVersion : null;
}
