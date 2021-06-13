import shrinkwrapDatabase from './utils/shrinkwrapDatabase';

import { loadRawNysRisTables } from '../raw_map_layer/cli/yargs_wrapper';
import { loadNysTrafficCountStations } from '../traffic_count_station_year_directions/cli/yargs_wrapper';
import { loadNysRisTargetMap } from '../target_map_layer/cli/yargs_wrapper';
import { shstMatchNysRis } from '../shst_matching_layer/cli/yargs_wrapper';

export * from '../raw_map_layer/cli/yargs_wrapper';
export * from '../traffic_count_station_year_directions/cli/yargs_wrapper';
export * from '../target_map_layer/cli/yargs_wrapper';

export * from '../shst_matching_layer/cli/yargs_wrapper';
// export * from '../outputShapefile/yargs_wrapper';
export * from '../outputMbtiles/yargs_wrapper';
export * from '../outputMbtilesForQA/yargs_wrapper';

export const nysRisAll = {
  command: 'nys_ris_all',
  desc: 'Load all NYS RIS input and run conflation.',
  builder: {
    ...loadRawNysRisTables.builder,
    ...loadNysTrafficCountStations.builder,
    ...loadNysRisTargetMap.builder,
    ...shstMatchNysRis.builder,
  },
  handler: async (args: any) => {
    await loadRawNysRisTables.handler(args);
    await loadNysTrafficCountStations.handler(args);
    loadNysRisTargetMap.handler();
    await shstMatchNysRis.handler();
  },
};

export const shrinkwrapNysRisDatabase = {
  command: 'shrinkwrap_nys_ris_database',
  desc: 'Make the NysRis database Read-Only',
  handler: shrinkwrapDatabase,
};
