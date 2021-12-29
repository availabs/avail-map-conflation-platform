/* eslint-disable no-underscore-dangle */

import { openSync, writeSync, mkdirSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import { conflationSpatialArbitraryDir } from './conflationSpatialPaths';

export default class GeoJsonCollectionWriter {
  readonly filePath: string;

  private position: number;

  private fd: number;

  constructor(readonly name: string) {
    this.filePath = join(conflationSpatialArbitraryDir, `${name}.geojson`);

    mkdirSync(conflationSpatialArbitraryDir, { recursive: true });

    // @ts-ignore
    this.fd = openSync(this.filePath, 'w');

    this.position = 0;
  }

  write(feature: turf.Feature) {
    if (this.position === 0) {
      const bytes = writeSync(
        this.fd,
        `{"type":"FeatureCollection","features": [${JSON.stringify(feature)}]}`,
        this.position,
        'utf8',
      );

      this.position += bytes;
    } else {
      this.position -= 2; // Need to overwrite the last ']}'

      const bytes = writeSync(
        this.fd,
        `,${JSON.stringify(feature)}]}`,
        this.position,
        'utf8',
      );

      this.position += bytes;
    }
  }
}
