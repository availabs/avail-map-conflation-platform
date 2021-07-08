/* eslint-disable import/prefer-default-export */

import { createDevConflationInputMapsGpkg } from '..';

export const devConflationInputMapsGpkg = {
  command: 'create_all_input_maps_gpkg',
  desc:
    'Create a GeoPackage with a layer for each conflation input map (Shst, NysRis, NPMRDS).',
  builder: {
    overwrite: {
      type: 'boolean',
      describe: 'Overwrite GeoPackage if it already exists.',
      default: false,
    },
  },
  handler: ({ overwrite }) => createDevConflationInputMapsGpkg(overwrite),
};
