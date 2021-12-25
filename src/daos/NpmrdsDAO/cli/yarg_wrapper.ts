import shrinkwrapDatabase from './utils/shrinkwrapDatabase';

import { loadRawNpmrdsTables } from '../raw_map_layer/cli/yargs_wrapper';
import { loadNpmrdsTargetMap } from '../target_map_layer/cli/yargs_wrapper';
import { shstMatchNpmrds } from '../shst_matching_layer/cli/yargs_wrapper';

export * from '../raw_map_layer/cli/yargs_wrapper';
export * from '../target_map_layer/cli/yargs_wrapper';
export * from '../shst_matching_layer/cli/yargs_wrapper';
export * from '../outputShapefile/yargs_wrapper';
export * from '../outputMbtiles/yargs_wrapper';
export * from '../outputMbtilesForQA/yargs_wrapper';

export const npmrdsAll = {
  command: 'npmrds_all',
  desc: 'Load all NPMRDS input and run conflation.',
  builder: {
    ...loadRawNpmrdsTables.builder,
    ...loadNpmrdsTargetMap.builder,
    ...shstMatchNpmrds.builder,
  },
  handler: async (args: any) => {
    await loadRawNpmrdsTables.handler(args);
    loadNpmrdsTargetMap.handler();
    await shstMatchNpmrds.handler();
  },
};

export const shrinkwrapNpmrdsDatabase = {
  command: 'shrinkwrap_npmrds_database',
  desc: 'Make the NPMRDS database Read-Only',
  handler: shrinkwrapDatabase,
};
