import { basename } from 'path';

import validateNysRisVersion from './validateNysRisVersion';

export default function getNysRisVersionFromPbfFileName(nysRisPbfFile: string) {
  const b = basename(nysRisPbfFile);

  if (!/\.gdb\.zip$/.test(b)) {
    return null;
  }

  const nysRisVersion = b.replace(/\.gdb\.zip$/, '');

  return validateNysRisVersion(nysRisVersion) ? nysRisVersion : null;
}
