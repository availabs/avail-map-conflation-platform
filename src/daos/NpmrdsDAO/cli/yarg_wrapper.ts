import shrinkwrapDatabase from './utils/shrinkwrapDatabase';

export * from '../raw_map_layer/cli/yargs_wrapper';
export * from '../target_map_layer/cli/yargs_wrapper';
export * from '../shst_matching_layer/cli/yargs_wrapper';
export * from '../outputShapefile/yargs_wrapper';
export * from '../outputMbtiles/yargs_wrapper';
export * from '../outputMbtilesForQA/yargs_wrapper';

export const shrinkwrapNpmrdsDatabase = {
  command: 'shrinkwrap_npmrds_database',
  desc: 'Make the NPMRDS database Read-Only',
  handler: shrinkwrapDatabase,
};
