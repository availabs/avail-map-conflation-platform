import { join, isAbsolute } from 'path';

const envVarOutputDirOverride =
  process.env.AVAIL_MAP_CONFLATION_OUTPUT_DIR || null;

const envVaribleOutputDirPath =
  envVarOutputDirOverride &&
  (isAbsolute(envVarOutputDirOverride)
    ? envVarOutputDirOverride
    : join(process.cwd(), envVarOutputDirOverride));

const defaultOutputDirPath = join(__dirname, '../../output/');

const outputDirectory = envVaribleOutputDirPath || defaultOutputDirPath;

console.log('outputDirectory:', outputDirectory);

export default outputDirectory;
