import { join, relative } from 'path';

const projectRoot = join(__dirname, '../');

export default (dirName: string, fileName: string) =>
  relative(projectRoot, join(dirName, fileName));
