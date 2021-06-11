import { join, isAbsolute } from 'path';

const envVarInputDirOverride =
  process.env.AVAIL_MAP_CONFLATION_INPUT_DIR || null;

const envVaribleInputDirPath =
  envVarInputDirOverride &&
  (isAbsolute(envVarInputDirOverride)
    ? envVarInputDirOverride
    : join(process.cwd(), envVarInputDirOverride));

const defaultInputDirPath = join(__dirname, '../../input/');

const inputDirectory = envVaribleInputDirPath || defaultInputDirPath;

console.log(inputDirectory);
export default inputDirectory;
