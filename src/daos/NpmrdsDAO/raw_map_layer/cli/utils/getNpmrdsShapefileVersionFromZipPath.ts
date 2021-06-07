import { basename } from 'path';

import isValidNpmrdsShapefileVersion from '../../utils/isValidNpmrdsShapefileVersion';

export default function getNpmrdsShapefileVersionFromZipPath(
  npmrdsShpZip: string,
) {
  const b = basename(npmrdsShpZip);

  const nysRisVersion = b.replace(/\.zip$/, '');

  return npmrdsShpZip !== nysRisVersion &&
    isValidNpmrdsShapefileVersion(nysRisVersion)
    ? nysRisVersion
    : null;
}
