import { join, relative } from 'path';

const projectRoot = join(__dirname, '../');

export type ModuleId = string;

export default (fileName: string) => relative(projectRoot, fileName);
