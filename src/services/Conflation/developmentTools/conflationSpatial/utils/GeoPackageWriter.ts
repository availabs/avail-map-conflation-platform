/* eslint-disable no-underscore-dangle */

import { exec, ChildProcess } from 'child_process';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import { conflationSpatialArbitraryDir } from './conflationSpatialPaths';

const ndjsonToGeoJsonScript = join(
  __dirname,
  '../../../../../../bin/ndjson_to_geojson',
);

export default class GeoPackageWriter {
  readonly gpkgPath: string;

  private readonly gpkgWriter: ChildProcess;

  constructor(readonly baseName: string) {
    mkdirSync(conflationSpatialArbitraryDir, { recursive: true });

    this.gpkgPath = join(conflationSpatialArbitraryDir, `${baseName}.gpkg`);

    if (existsSync(this.gpkgPath)) {
      unlinkSync(this.gpkgPath);
    }

    this.gpkgWriter = exec(
      `
        ${ndjsonToGeoJsonScript} |
        ogr2ogr \
          -F GeoJSON  \
          -nln INPUT  \
          /vsistdout/ \
          /vsistdin/  |
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${this.gpkgPath} \
          /vsistdin/ \
          -nln ${baseName}
      `,
    );

    this.gpkgWriter.stdout?.pipe(process.stdout);
    this.gpkgWriter.stderr?.pipe(process.stderr);

    // @ts-ignore
    this.gpkgWriter.stdin.setDefaultEncoding('utf8');

    console.error('GPKG WRITER');
  }

  write(feature: turf.Feature) {
    if (feature?.properties?._other_tags) {
      // eslint-disable-next-line  no-param-reassign
      feature.properties.other_tags = JSON.stringify(
        feature.properties.other_tags,
      );
    }

    // @ts-ignore
    this.gpkgWriter.stdin.write(`${JSON.stringify(feature)}\n`);
  }

  close() {
    this.gpkgWriter.stdin?.end();
  }
}
