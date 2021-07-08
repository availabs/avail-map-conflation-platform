/* eslint-disable import/prefer-default-export */

import {
  outputSqliteDir,
  conflationInputMapsGpkgPath,
} from './utils/conflationSpatialPaths';

import createAllConflationInputMapsGpkg from './utils/createAllConflationInputMapsGpkg';

export function createDevConflationInputMapsGpkg(overwrite: boolean = false) {
  createAllConflationInputMapsGpkg(
    conflationInputMapsGpkgPath,
    outputSqliteDir,
    overwrite,
  );
}
