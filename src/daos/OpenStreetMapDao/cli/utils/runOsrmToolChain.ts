/*
    https://github.com/Project-OSRM/osrm-backend/wiki/Running-OSRM
*/

import { execSync } from 'child_process';
import { existsSync, mkdirSync, symlinkSync } from 'fs';
import { relative, join } from 'path';

import { removeSync } from 'fs-extra';

import outputDirectory from '../../../../constants/outputDirectory';

import OsmDao from '../..';

const osrmNodeModulesDir = join(__dirname, '../../../../../node_modules/osrm');

const osrmExtract = join(osrmNodeModulesDir, 'lib/binding/osrm-extract');

// Contraction Hierarchies
const osrmContract = join(osrmNodeModulesDir, 'lib/binding/osrm-contract');

// Multi-Level Dijkstra
// const osrmPartition = join(osrmNodeModulesDir, 'lib/binding/osrm-partition');
// const osrmCustomize = join(osrmNodeModulesDir, 'lib/binding/osrm-customize');

const osrmCarProfile = join(__dirname, './osrmProfiles/car.nys_ris.lua');

const osrmDataDir = join(outputDirectory, 'osrm');

// buildOsrmFiles is passed the yargs args.
//   cannot offer the osrmProfile option until it's called by internal code.
// export default function buildOsrmFiles(osrmProfile: string = osrmCarProfile) {
export default function buildOsrmFiles() {
  const { osmPbfFilePath } = OsmDao;

  if (!existsSync(osmPbfFilePath)) {
    throw new Error(`OSM PBF file does not exists: ${osmPbfFilePath}`);
  }

  removeSync(osrmDataDir);
  mkdirSync(osrmDataDir, { recursive: true });

  const pbfSymlinkPath = join(osrmDataDir, 'osm.pbf');

  symlinkSync(relative(osrmDataDir, osmPbfFilePath), pbfSymlinkPath);

  execSync(
    `${osrmExtract} \
        osm.pbf \
        -p ${osrmCarProfile}
    `,
    { cwd: osrmDataDir },
  );

  // execSync(`${osrmPartition} osm.osrm`, { cwd: osrmDataDir });
  // execSync(`${osrmCustomize} osm.osrm`, { cwd: osrmDataDir });

  execSync(`${osrmContract} osm.osrm`, { cwd: osrmDataDir });
}
