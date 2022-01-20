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

export default class SpatiaLiteWriter {
  readonly dbPath: string;

  private _dbWriter?: ChildProcess;

  constructor(
    readonly baseName: string,
    dbPath?: string,
    clean: boolean = true,
  ) {
    mkdirSync(conflationSpatialArbitraryDir, { recursive: true });

    this.dbPath =
      dbPath || join(conflationSpatialArbitraryDir, `${baseName}.sqlite3`);

    if (clean && existsSync(this.dbPath)) {
      unlinkSync(this.dbPath);
    }
  }

  private get dbWriter(): ChildProcess {
    if (!this._dbWriter) {
      // ogr2ogr -F SQLite db.sqlite target_map_path.geojson -nln target_map_paths
      this._dbWriter = exec(
        `
          ${ndjsonToGeoJsonScript} |
          ogr2ogr \
            -overwrite \
            -F SQLite \
            -dsco SPATIALITE=YES \
            ${this.dbPath} \
            /vsistdin/ \
            -nln ${this.baseName}
        `,
      );

      this.dbWriter.stdout?.pipe(process.stdout);
      this.dbWriter.stderr?.pipe(process.stderr);

      // @ts-ignore
      this.dbWriter.stdin.setDefaultEncoding('utf8');

      this.dbWriter.on('close', () => {
        execSync(`sqlite3 ${this.dbPath} 'pragma journal_mode=DELETE'`);
      });
    }

    return this._dbWriter;
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
    this.dbWriter.stdin.write(`${JSON.stringify(copy)}\n`);
  }

  close() {
    if (this._dbWriter?.stdin) {
      this._dbWriter.stdin.end();
    }
  }
}
