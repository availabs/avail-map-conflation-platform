/* eslint-disable no-underscore-dangle */

import { exec, execSync, ChildProcess } from 'child_process';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';

import _ from 'lodash';

import { conflationSpatialArbitraryDir } from './conflationSpatialPaths';

const ndjsonToGeoJsonScript = join(
  __dirname,
  '../../../../../../bin/ndjson_to_geojson',
);

export default class GeoPackageWriter {
  readonly gpkgPath: string;

  private _gpkgWriter?: ChildProcess;

  constructor(readonly baseName: string) {
    mkdirSync(conflationSpatialArbitraryDir, { recursive: true });

    this.gpkgPath = join(conflationSpatialArbitraryDir, `${baseName}.gpkg`);

    if (existsSync(this.gpkgPath)) {
      unlinkSync(this.gpkgPath);
    }
  }

  private get gpkgWriter(): ChildProcess {
    if (!this._gpkgWriter) {
      this._gpkgWriter = exec(
        `
          ${ndjsonToGeoJsonScript} |
          ogr2ogr \
            -overwrite \
            -F GPKG \
            ${this.gpkgPath} \
            /vsistdin/ \
            -nln ${this.baseName}
        `,
      );

      this.gpkgWriter.stdout?.pipe(process.stdout);
      this.gpkgWriter.stderr?.pipe(process.stderr);

      // @ts-ignore
      this.gpkgWriter.stdin.setDefaultEncoding('utf8');

      this.gpkgWriter.on('close', () => {
        execSync(`sqlite3 ${this.gpkgPath} 'pragma journal_mode=DELETE'`);
      });
    }

    return this._gpkgWriter;
  }

  write(feature: turf.Feature, otherTags: string[] = []) {
    const copy = { ...feature };
    copy.properties = copy.properties || {};

    if (otherTags.length) {
      copy.properties = _.omit(feature.properties, otherTags);
      copy.properties._other_tags = _.pick(feature.properties, otherTags);
    }

    if (feature?.properties?._other_tags) {
      // eslint-disable-next-line  no-param-reassign
      copy.properties._other_tags = JSON.stringify(copy.properties._other_tags);
    }

    // @ts-ignore
    this.gpkgWriter.stdin.write(`${JSON.stringify(copy)}\n`);
  }

  close() {
    if (this._gpkgWriter?.stdin) {
      this._gpkgWriter.stdin.end();
    }
  }
}
