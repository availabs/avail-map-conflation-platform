import { existsSync, readdirSync } from 'fs';

import nysRisInputDirectory from '../../../raw_map_layer/cli/constants/nysRisInputDirectory';

import getNysTrafficCountStationsVersionFromCsvGzipName from '../utils/getNysTrafficCountStationsVersionFromCsvGzipName';

export default existsSync(nysRisInputDirectory)
  ? readdirSync(nysRisInputDirectory)
      .map(getNysTrafficCountStationsVersionFromCsvGzipName)
      .filter((v) => v)
  : [];
