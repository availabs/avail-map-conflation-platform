import {
  existsSync,
  readdirSync,
  mkdirSync,
  symlinkSync,
  watch,
  FSWatcher,
} from 'fs';
import { join } from 'path';

import _ from 'lodash';

import { removeSync } from 'fs-extra';

import validateTimestamp from './validateTimestamp';

export type DiffMetadata = {
  a_timestamp: string;
  b_timestamp: string;
  timestamps: [string, string];
  diffName: string;
  diffPath: string;
};

export default class DiffsFsUtils {
  static checkTimestamp(timestamp: string) {
    if (!validateTimestamp(timestamp)) {
      throw new Error(`${timestamp} is not in UNIX timestamp format`);
    }
  }

  static checkDiffTimestamps([a_timestamp, b_timestamp]: [string, string]) {
    DiffsFsUtils.checkTimestamp(a_timestamp);
    DiffsFsUtils.checkTimestamp(b_timestamp);

    // NOTE: This invariant simplifies things
    if (!(a_timestamp < b_timestamp)) {
      throw new Error(`${a_timestamp} does not preceed ${b_timestamp}`);
    }
  }

  readonly dir: string;

  private nameCore: string;

  private ext: string;

  private extension: string;

  private diffNameRE: RegExp;

  private timestampsCaptureRE: RegExp;

  readonly diffSymlinkNameRE: RegExp;

  readonly latestDifferentialDiffSymlinkName: string;

  readonly latestDifferentialDiffSymlinkPath: string;

  readonly latestIncrementalDiffSymlinkName: string;

  readonly latestIncrementalDiffSymlinkPath: string;

  private autoSymlinksDirWatcher!: FSWatcher | null;

  constructor({ dir, nameCore, ext, autoUpdateSymlinks }) {
    this.dir = dir;

    this.nameCore = nameCore;
    this.ext = ext;
    this.extension = this.ext ? `.${this.ext}` : '';

    const escapedNameCore = this.nameCore.replace(/\./g, '\\.');
    const escapedExt = this.extension.replace(/\./g, '\\.');

    this.diffNameRE = new RegExp(
      `^${escapedNameCore}\\.\\d{10}-\\d{10}${escapedExt}$`,
    );

    this.timestampsCaptureRE = new RegExp(
      `^${escapedNameCore}\\.(\\d{10})-(\\d{10})${escapedExt}$`,
    );

    this.latestDifferentialDiffSymlinkName = `${nameCore}.latest_differential{this.extension}`;

    this.latestDifferentialDiffSymlinkPath = join(
      dir,
      this.latestDifferentialDiffSymlinkName,
    );

    this.latestIncrementalDiffSymlinkName = `${nameCore}.latest_differential{this.extension}`;

    this.latestIncrementalDiffSymlinkPath = join(
      dir,
      this.latestIncrementalDiffSymlinkName,
    );

    this.diffSymlinkNameRE = new RegExp(
      `^${escapedNameCore}\\.(latest_differential|latest_incremental)${escapedExt}$`,
    );

    if (autoUpdateSymlinks === true) {
      mkdirSync(this.dir, { recursive: true });
      this.autoUpdateDiffSymlinks();
    } else {
      this.autoSymlinksDirWatcher = null;
    }
  }

  getDiffName([a_timestamp, b_timestamp]: [string, string]) {
    DiffsFsUtils.checkDiffTimestamps([a_timestamp, b_timestamp]);

    return `${this.nameCore}.${a_timestamp}-${b_timestamp}${this.extension}`;
  }

  getDiffPath(timestamps: [string, string]) {
    return join(this.dir, this.getDiffName(timestamps));
  }

  parseDiffName(diffName: string): DiffMetadata {
    // @ts-ignore
    const [, a_timestamp, b_timestamp] =
      diffName.match(this.timestampsCaptureRE) || [];

    if (!(a_timestamp && b_timestamp)) {
      throw new Error(`invalid diff name ${diffName}`);
    }

    const timestamps: [string, string] = [a_timestamp, b_timestamp];

    const diffPath = this.getDiffPath(timestamps);

    return {
      timestamps,
      a_timestamp,
      b_timestamp,
      diffName,
      diffPath,
    };
  }

  get existingDiffNames() {
    return existsSync(this.dir)
      ? readdirSync(this.dir, { withFileTypes: true })
          .filter(
            (dirent) =>
              // NOTE: Filters out the symlinks
              dirent.isFile() && this.diffNameRE.test(dirent.name),
          )
          .map(({ name }) => name)
          .sort() // ASSUMED ELSEWHERE
      : [];
  }

  get existingDiffsMetadata() {
    return this.existingDiffNames.map(this.parseDiffName.bind(this));
  }

  get existingDiffTimestamps() {
    return this.existingDiffsMetadata.map(({ timestamps }) => timestamps);
  }

  get existingDiffPaths() {
    return this.existingDiffsMetadata.map(({ diffPath }) => diffPath);
  }

  get latestDiffsMetadata() {
    const { existingDiffTimestamps } = this;

    const allTimestamps = _(existingDiffTimestamps)
      .flattenDeep()
      .sort()
      .uniq()
      .value();

    console.log('latestDiffsMetadata');
    console.log(JSON.stringify({ allTimestamps }, null, 4));
    const [initial = null] = allTimestamps;

    // NOTE: a_timestamp guaranteed < b_timestamp, therefore at least two unique.
    const [penult, latest] = allTimestamps.slice(-2);

    // === Differential Diff (initial, latest)

    const differentialDiffTimestamps: [string, string] | null =
      initial && latest ? [initial, latest] : null;

    const differentialDiffName =
      differentialDiffTimestamps &&
      this.getDiffName(differentialDiffTimestamps);

    const differentialDiffPath =
      differentialDiffTimestamps &&
      this.getDiffPath(differentialDiffTimestamps);

    const differentialExists =
      differentialDiffPath && existsSync(differentialDiffPath);

    // === Incremental Diff (penult, latest)

    const incrementalDiffTimestamps: [string, string] | null =
      penult && latest ? [penult, latest] : null;

    const incrementalDiffName =
      incrementalDiffTimestamps && this.getDiffName(incrementalDiffTimestamps);
    const incrementalDiffPath =
      incrementalDiffTimestamps && this.getDiffPath(incrementalDiffTimestamps);

    const incrementalExists =
      incrementalDiffPath && existsSync(incrementalDiffPath);

    return {
      differential: {
        a_timestamp: differentialExists ? initial : null,
        b_timestamp: differentialExists ? latest : null,

        timestamps: differentialExists ? differentialDiffTimestamps : null,

        diffName: differentialExists ? differentialDiffName : null,

        diffPath: differentialExists ? differentialDiffPath : null,
      },

      incremental: {
        a_timestamp: incrementalExists ? penult : null,
        b_timestamp: incrementalExists ? latest : null,

        timestamps: incrementalExists ? incrementalDiffTimestamps : null,

        diffName: incrementalExists ? incrementalDiffName : null,

        diffPath: incrementalExists ? incrementalDiffPath : null,
      },
    };
  }

  get missingDiffsMetadata(): {
    missingDifferentialDiffsMeta: DiffMetadata[];
    missingIncrementalDiffsMeta: DiffMetadata[];
  } {
    const { existingDiffTimestamps } = this;

    const allTimestamps = _(existingDiffTimestamps)
      .flattenDeep()
      .sort()
      .uniq()
      .value();

    const [initial] = allTimestamps;

    const missingDifferentialDiffsMeta = allTimestamps.reduce(
      (missingDifferentialMetaAcc: DiffMetadata[], b_timestamp, i) => {
        if (i === 0) {
          return missingDifferentialMetaAcc;
        }

        const timestamps: [string, string] = [initial, b_timestamp];

        const diffName = this.getDiffName(timestamps);
        const diffPath = this.getDiffPath(timestamps);

        if (!existsSync(diffPath)) {
          missingDifferentialMetaAcc.push({
            a_timestamp: initial,
            b_timestamp,
            timestamps,
            diffName,
            diffPath,
          });
        }

        return missingDifferentialMetaAcc;
      },
      [],
    );

    const missingIncrementalDiffsMeta = allTimestamps
      .slice(1)
      .reduce((missingIncrementalMetaAcc: DiffMetadata[], b_timestamp, i) => {
        const a_timestamp = allTimestamps[i];

        const timestamps: [string, string] = [a_timestamp, b_timestamp];

        const diffName = this.getDiffName(timestamps);
        const diffPath = this.getDiffPath(timestamps);

        if (!existsSync(diffPath)) {
          missingIncrementalMetaAcc.push({
            a_timestamp,
            b_timestamp,
            timestamps,
            diffName,
            diffPath,
          });
        }

        return missingIncrementalMetaAcc;
      }, []);

    return {
      missingDifferentialDiffsMeta,
      missingIncrementalDiffsMeta,
    };
  }

  updateDiffSymlinks() {
    // For atomicity
    const { latestDiffsMetadata } = this;

    const differentialSymlinkPath = this.latestDifferentialDiffSymlinkPath;

    const incrementalSymlinkPath = this.latestIncrementalDiffSymlinkPath;

    try {
      removeSync(differentialSymlinkPath);
    } catch (err) {
      // noop
    }

    try {
      removeSync(incrementalSymlinkPath);
    } catch (err) {
      // noop
    }

    const {
      differential: { diffName: differentialDiffName },
      incremental: { diffName: incrementalDiffName },
    } = latestDiffsMetadata;

    if (differentialDiffName !== null) {
      symlinkSync(differentialDiffName, differentialSymlinkPath);
    }

    if (incrementalDiffName !== null) {
      symlinkSync(incrementalDiffName, incrementalSymlinkPath);
    }
  }

  get isAutoUpdatingDiffSymlinks() {
    return this.autoSymlinksDirWatcher !== null;
  }

  autoUpdateDiffSymlinks(
    fsWatchOptions: {
      persistent?: boolean;
      recursive?: boolean;
    } = {},
  ) {
    if (this.isAutoUpdatingDiffSymlinks) {
      return;
    }

    const options = {
      persistent: fsWatchOptions.persistent ?? true,
      recursive: fsWatchOptions.recursive ?? false,
      encoding: 'utf8',
    };

    // @ts-ignore
    this.autoSymlinksDirWatcher = watch(this.dir, options);

    this.autoSymlinksDirWatcher.on('change', (eventType, filename: string) => {
      if (!filename) {
        console.log(
          `${this.dir}: ${eventType} no file name. Symlinks not updated.`,
        );
      }

      if (!this.diffSymlinkNameRE.test(filename)) {
        console.log(`${this.dir}: ${eventType} ${filename}`);
        this.updateDiffSymlinks.bind(this);
      }
    });
  }

  noAutoUpdateDiffSymlinks() {
    if (this.autoSymlinksDirWatcher !== null) {
      return;
    }

    // @ts-ignore
    this.autoSymlinksDirWatcher.close();
    this.autoSymlinksDirWatcher = null;
  }

  removeDiffsByMetadataFilter(
    metadataFilterFn: (metadata: DiffMetadata) => boolean,
  ) {
    const { isAutoUpdatingDiffSymlinks } = this;

    if (isAutoUpdatingDiffSymlinks) {
      this.noAutoUpdateDiffSymlinks();
    }

    const removedDiffsMetadata: DiffMetadata[] = [];

    this.existingDiffsMetadata.forEach((metadata) => {
      const { diffPath } = metadata;

      if (metadataFilterFn(metadata)) {
        try {
          removeSync(diffPath);

          removedDiffsMetadata.push(metadata);
        } catch (err) {
          // noop
        }
      }
    });

    // NOTE: Likely that latest differential diffs no longer exist and symlink will be removed.
    this.updateDiffSymlinks();

    if (isAutoUpdatingDiffSymlinks) {
      this.autoUpdateDiffSymlinks();
    }

    const { missingDiffsMetadata } = this;

    return {
      removedDiffsMetadata,
      missingDiffsMetadata,
    };
  }

  removeAllDiffsBeforeTimestamp(minTimestamp: string) {
    this.removeDiffsByMetadataFilter(
      // NOTE: a_timestamp guaranteed < b_timestamp
      ({ a_timestamp }) => a_timestamp < minTimestamp,
    );
  }

  removeAllDiffsAfterTimestamp(maxTimestamp: string) {
    this.removeDiffsByMetadataFilter(
      // NOTE: b_timestamp guaranteed > a_timestamp
      ({ b_timestamp }) => b_timestamp > maxTimestamp,
    );
  }
}
