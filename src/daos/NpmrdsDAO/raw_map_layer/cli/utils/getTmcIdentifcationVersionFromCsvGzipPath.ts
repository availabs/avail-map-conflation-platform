import { basename } from 'path';

import isValidTmcIdentificationVersion from '../../utils/isValidTmcIdentificationVersion';

export default function getTmcIdentifictionVersionFromCsvGzipPath(
  tmcIdentificationCsvGzip: string,
) {
  const b = basename(tmcIdentificationCsvGzip);

  const tmcIdentificationVersion = b.replace(/\.csv\.gz$/, '');

  return tmcIdentificationVersion !== tmcIdentificationCsvGzip &&
    isValidTmcIdentificationVersion(tmcIdentificationVersion)
    ? tmcIdentificationVersion
    : null;
}
