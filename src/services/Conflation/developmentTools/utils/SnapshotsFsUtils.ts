import {
  existsSync,
  readdirSync,
  mkdirSync,
  symlinkSync,
  watch,
  FSWatcher,
} from 'fs';
import { join } from 'path';

import { removeSync } from 'fs-extra';

import validateTimestamp from './validateTimestamp';

type SnapshotMetadata = {
  timestamp: string;
  snapshotName: string;
  snapshotPath: string;
};

export default class SnapshotsFsUtils {
  static checkTimestamp(timestamp: string) {
    if (!validateTimestamp(timestamp)) {
      throw new Error(`${timestamp} is not in UNIX timestamp format`);
    }
  }

  private dir: string;

  private nameCore: string;

  private ext: string;

  private extension: string;

  private snapshotNameRE: RegExp;

  private timestampCaptureRE: RegExp;

  readonly snapshotSymlinkNameRE: RegExp;

  readonly initialSnapshotSymlinkName: string;

  readonly initialSnapshotSymlinkPath: string;

  readonly latestSnapshotSymlinkName: string;

  readonly latestSnapshotSymlinkPath: string;

  // @ts-ignore
  private autoSymlinksDirWatcher: FSWatcher | null;

  constructor({ dir, nameCore, ext, autoUpdateSymlinks }) {
    this.dir = dir;
    this.nameCore = nameCore;
    this.ext = ext;
    this.extension = this.ext ? `.${this.ext}` : '';

    const escapedNameCore = this.nameCore.replace(/\./g, '\\.');
    const escapedExt = this.extension.replace(/\./g, '\\.');

    this.snapshotNameRE = new RegExp(
      `^${escapedNameCore}\\.\\d{10}${escapedExt}$`,
    );

    this.timestampCaptureRE = new RegExp(
      `^${escapedNameCore}\\.(\\d{10})${escapedExt}$`,
    );

    this.snapshotSymlinkNameRE = new RegExp(
      `^${escapedNameCore}\\.(initial|latest)${escapedExt}$`,
    );

    this.initialSnapshotSymlinkName = `${this.nameCore}.initial${this.extension}`;

    this.initialSnapshotSymlinkPath = join(
      dir,
      this.initialSnapshotSymlinkName,
    );

    this.latestSnapshotSymlinkName = `${this.nameCore}.latest${this.extension}`;

    this.latestSnapshotSymlinkPath = join(dir, this.latestSnapshotSymlinkName);

    if (autoUpdateSymlinks === true) {
      mkdirSync(this.dir, { recursive: true });
      this.autoUpdateSnapshotSymlinks();
    } else {
      this.autoSymlinksDirWatcher = null;
    }
  }

  getSnapshotName(timestamp: string) {
    SnapshotsFsUtils.checkTimestamp(timestamp);

    return `${this.nameCore}.${timestamp}${this.extension}`;
  }

  getSnapshotPath(timestamp: string) {
    return join(this.dir, this.getSnapshotName(timestamp));
  }

  parseSnapshotName(snapshotName: string): SnapshotMetadata {
    // @ts-ignore
    const [, timestamp] = snapshotName.match(this.timestampCaptureRE) || [];

    if (!timestamp) {
      throw new Error(`invalid snapshot name ${snapshotName}`);
    }

    return {
      timestamp,
      snapshotName,
      snapshotPath: this.getSnapshotPath(timestamp),
    };
  }

  get existingSnapshotNames() {
    return existsSync(this.dir)
      ? readdirSync(this.dir, { withFileTypes: true })
          .filter(
            (dirent) =>
              // NOTE: Filters out the symlinks
              dirent.isFile() && this.snapshotNameRE.test(dirent.name),
          )
          .map(({ name }) => name)
          .sort() // ASSUMED ELSEWHERE
      : [];
  }

  get existingSnapshotsMetadata() {
    return this.existingSnapshotNames.map(this.parseSnapshotName.bind(this));
  }

  get existingSnapshotTimestamps() {
    return this.existingSnapshotsMetadata.map(({ timestamp }) => timestamp);
  }

  get existingSnapshotPaths() {
    return this.existingSnapshotsMetadata.map(
      ({ snapshotPath }) => snapshotPath,
    );
  }

  get initialSnapshotTimestamp() {
    const timestamps = this.existingSnapshotTimestamps;

    return timestamps[0] ?? null;
  }

  get initialSnapshotName() {
    return this.existingSnapshotNames[0] ?? null;
  }

  get initialSnapshotPath() {
    return this.existingSnapshotPaths[0] ?? null;
  }

  get latestSnapshotTimestamp() {
    return (
      this.existingSnapshotTimestamps[
        this.existingSnapshotTimestamps.length - 1
      ] ?? null
    );
  }

  get latestSnapshotName() {
    return (
      this.existingSnapshotNames[this.existingSnapshotNames.length - 1] ?? null
    );
  }

  get latestSnapshotPath() {
    return (
      this.existingSnapshotPaths[this.existingSnapshotPaths.length - 1] ?? null
    );
  }

  updateSnapshotSymlinks() {
    // For atomicity not using initialSnapshotPath and latestSnapshotPath
    const { existingSnapshotNames } = this;

    if (existingSnapshotNames.length === 0) {
      return;
    }

    const initial = existingSnapshotNames[0];

    try {
      removeSync(this.initialSnapshotSymlinkPath);
    } catch (err) {
      // noop
    }

    symlinkSync(initial, this.initialSnapshotSymlinkPath);

    const latest = existingSnapshotNames[existingSnapshotNames.length - 1];

    try {
      removeSync(this.latestSnapshotSymlinkPath);
    } catch (err) {
      // noop
    }

    symlinkSync(latest, this.latestSnapshotSymlinkPath);
  }

  get isAutoUpdatingSnapshotSymlinks() {
    return this.autoSymlinksDirWatcher !== null;
  }

  autoUpdateSnapshotSymlinks(
    fsWatchOptions: {
      persistent?: boolean;
      recursive?: boolean;
    } = {},
  ) {
    if (this.isAutoUpdatingSnapshotSymlinks) {
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

      if (!this.snapshotSymlinkNameRE.test(filename)) {
        console.log(`${this.dir}: ${eventType} ${filename}`);
        this.updateSnapshotSymlinks.bind(this);
      }
    });
  }

  noAutoUpdateSnapshotSymlinks() {
    if (!this.isAutoUpdatingSnapshotSymlinks) {
      return;
    }

    this.autoSymlinksDirWatcher.close();
    this.autoSymlinksDirWatcher = null;
  }

  removeSnapshotsByMetadataFilter(
    timestampFilterFn: (metadata: SnapshotMetadata) => boolean,
  ) {
    const { isAutoUpdatingSnapshotSymlinks } = this;

    if (isAutoUpdatingSnapshotSymlinks) {
      this.noAutoUpdateSnapshotSymlinks();
    }

    const removedSnapshotsMetadata: SnapshotMetadata[] = [];

    this.existingSnapshotsMetadata.forEach((metadata) => {
      const { snapshotPath } = metadata;

      if (timestampFilterFn(metadata)) {
        try {
          removeSync(snapshotPath);

          removedSnapshotsMetadata.push(metadata);
        } catch (err) {
          // noop
        }
      }
    });

    // NOTE: Likely that latest differential diffs no longer exist and symlink will be removed.
    this.updateSnapshotSymlinks();

    if (isAutoUpdatingSnapshotSymlinks) {
      this.autoUpdateSnapshotSymlinks();
    }

    return {
      removedSnapshotsMetadata,
    };
  }

  removeAllSnapshotsBeforeTimestamp(minTimestamp: string) {
    this.removeSnapshotsByMetadataFilter(
      ({ timestamp }) => timestamp < minTimestamp,
    );
  }

  removeAllSnapshotsAfterTimestamp(maxTimestamp: string) {
    this.removeSnapshotsByMetadataFilter(
      ({ timestamp }) => timestamp > maxTimestamp,
    );
  }
}
