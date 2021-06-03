import { existsSync, readdirSync } from 'fs';

import nysRisInputDirectory from './nysRisInputDirectory';

import getNysRisVersionFromGdbZipName from '../utils/getNysRisVersionFromGdbZipName';

export default existsSync(nysRisInputDirectory)
  ? readdirSync(nysRisInputDirectory)
      .map(getNysRisVersionFromGdbZipName)
      .filter((v) => v)
  : [];
