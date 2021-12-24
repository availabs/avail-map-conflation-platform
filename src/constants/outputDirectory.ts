import { join, isAbsolute } from 'path';

// Can override the default output directory using an ENV variable.
const envVarOutputDirOverride =
  process.env.AVAIL_MAP_CONFLATION_OUTPUT_DIR || null;

let envVaribleOutputDirPath: string | null = null;

if (envVarOutputDirOverride) {
  envVaribleOutputDirPath = isAbsolute(envVarOutputDirOverride)
    ? envVarOutputDirOverride
    : join(process.cwd(), envVarOutputDirOverride);
}

const defaultOutputDirPath = join(__dirname, '../../output/');

const outputDirectory = envVaribleOutputDirPath || defaultOutputDirPath;

export default outputDirectory;
