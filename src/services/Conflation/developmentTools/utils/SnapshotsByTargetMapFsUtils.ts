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
import validateTargetMapName from './validateTargetMapName';

type SnapshotMetadata = {
  targetMap: string;
  timestamp: string;
  snapshotName: string;
  snapshotPath: string;
};

export default class SnapshotsByTargetMapFsUtils {
  static checkTargetMapName(targetMap: string) {
    if (!validateTargetMapName(targetMap)) {
      throw new Error(
        `TargetMap names must be lower case letters with optional underscores. ${targetMap} is invalid.`,
      );
    }
  }

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

  private targetMapNameCaptureRE: RegExp;

  private timestampCaptureRE: RegExp;

  readonly snapshotSymlinkNameRE: RegExp;

  private autoSymlinksDirWatcher: FSWatcher | null;

  constructor({ dir, nameCore, ext, autoUpdateSymlinks }) {
    this.dir = dir;
    this.nameCore = nameCore;
    this.ext = ext;
    this.extension = this.ext ? `.${this.ext}` : '';

    const escapedNameCore = this.nameCore.replace(/\./g, '\\.');
    const targetMapPattern = '[a-z_]{1,}';
    const escapedExt = this.extension.replace(/\./g, '\\.');

    this.snapshotNameRE = new RegExp(
      `^${escapedNameCore}\\.${targetMapPattern}\\.\\d{10}${escapedExt}$`,
    );

    this.targetMapNameCaptureRE = new RegExp(
      `^${escapedNameCore}\\.(${targetMapPattern})\\.\\d{10}${escapedExt}$`,
    );

    this.timestampCaptureRE = new RegExp(
      `^${escapedNameCore}\\.${targetMapPattern}\\.(\\d{10})${escapedExt}$`,
    );

    this.snapshotSymlinkNameRE = new RegExp(
      `^${escapedNameCore}\\.${targetMapPattern}\\.(initial|latest)${escapedExt}$`,
    );

    if (autoUpdateSymlinks === true) {
      mkdirSync(this.dir, { recursive: true });
      this.autoUpdateSnapshotSymlinks();
    } else {
      this.autoSymlinksDirWatcher = null;
    }
  }

  getSnapshotName(targetMap: string, timestamp: string) {
    SnapshotsByTargetMapFsUtils.checkTargetMapName(targetMap);
    SnapshotsByTargetMapFsUtils.checkTimestamp(timestamp);

    return `${this.nameCore}.${targetMap}.${timestamp}${this.extension}`;
  }

  getSnapshotPath(targetMap: string, timestamp: string) {
    return join(this.dir, this.getSnapshotName(targetMap, timestamp));
  }

  getInitialSnapshotSymlinkName(targetMap: string) {
    return `${this.nameCore}.${targetMap}.initial${this.extension}`;
  }

  getInitialSnapshotSymlinkPath(targetMap: string) {
    return join(this.dir, this.getInitialSnapshotSymlinkName(targetMap));
  }

  getLatestSnapshotSymlinkName(targetMap: string) {
    return `${this.nameCore}.${targetMap}.latest${this.extension}`;
  }

  getLatestSnapshotSymlinkPath(targetMap: string) {
    return join(this.dir, this.getLatestSnapshotSymlinkName(targetMap));
  }

  parseSnapshotName(snapshotName: string): SnapshotMetadata {
    // @ts-ignore
    const [, targetMap] = snapshotName.match(this.targetMapNameCaptureRE) || [];
    const [, timestamp] = snapshotName.match(this.timestampCaptureRE) || [];

    if (!(targetMap && timestamp)) {
      throw new Error(`invalid snapshot name ${snapshotName}`);
    }

    return {
      targetMap,
      timestamp,
      snapshotName,
      snapshotPath: this.getSnapshotPath(targetMap, timestamp),
    };
  }

  get existingSnapshotNames() {
    return existsSync(this.dir)
      ? readdirSync(this.dir, { withFileTypes: true })
          .filter(
            (dirent) =>
              dirent.isFile() && this.snapshotNameRE.test(dirent.name),
          )
          .map(({ name }) => name)
          .sort() // ASSUMED ELSEWHERE
      : [];
  }

  get existingSnapshotsMetadata() {
    return this.existingSnapshotNames.map(this.parseSnapshotName.bind(this));
  }

  get existingSnapshotTimestampsByTargetMap() {
    const timestampsByTargetMap = this.existingSnapshotsMetadata.reduce(
      (acc: Record<string, string[]>, { targetMap, timestamp }) => {
        acc[targetMap] = acc[targetMap] || [];

        acc[targetMap].push(timestamp);

        return acc;
      },
      {},
    );

    return timestampsByTargetMap;
  }

  get existingSnapshotNamesByTargetMap() {
    const timestampsByTargetMap = this.existingSnapshotsMetadata.reduce(
      (acc: Record<string, string[]>, { targetMap, snapshotName }) => {
        acc[targetMap] = acc[targetMap] || [];

        acc[targetMap].push(snapshotName);

        return acc;
      },
      {},
    );

    return timestampsByTargetMap;
  }

  get existingSnapshotPathsByTargetMap() {
    const timestampsByTargetMap = this.existingSnapshotsMetadata.reduce(
      (acc: Record<string, string[]>, { targetMap, snapshotPath }) => {
        acc[targetMap] = acc[targetMap] || [];

        acc[targetMap].push(snapshotPath);

        return acc;
      },
      {},
    );

    return timestampsByTargetMap;
  }

  get targetMapsWithSnapshots() {
    return _.uniq(
      this.existingSnapshotsMetadata.map(({ targetMap }) => targetMap),
    );
  }

  get commonExistingTimestamps() {
    const { existingSnapshotTimestampsByTargetMap } = this;

    const targetMaps = Object.keys(existingSnapshotTimestampsByTargetMap);

    const tstamps = targetMaps.map(
      (tMap) => existingSnapshotTimestampsByTargetMap[tMap],
    );

    const commonTimestamps = _.intersection(...tstamps).sort();

    return { targetMaps, commonTimestamps };
  }

  getInitialSnapshotTimestampForTargetMap(targetMap: string) {
    const timestampsByTargetMap = this.existingSnapshotTimestampsByTargetMap;

    const snapshotsForTargetMap = timestampsByTargetMap[targetMap];

    return snapshotsForTargetMap?.length ? snapshotsForTargetMap[0] : null;
  }

  getInitialSnapshotPathForTargetMap(targetMap: string) {
    const timestamp = this.getInitialSnapshotTimestampForTargetMap(targetMap);

    return timestamp && this.getSnapshotPath(targetMap, timestamp);
  }

  getLatestSnapshotTimestampForTargetMap(targetMap: string) {
    const existingSnapshotsByTargetMap = this
      .existingSnapshotTimestampsByTargetMap;

    const snapshotsForTargetMap = existingSnapshotsByTargetMap[targetMap];

    return snapshotsForTargetMap?.length
      ? snapshotsForTargetMap[snapshotsForTargetMap.length - 1]
      : null;
  }

  getLatestSnapshotNameForTargetMap(targetMap: string) {
    const timestamp = this.getLatestSnapshotTimestampForTargetMap(targetMap);

    return timestamp && this.getSnapshotName(targetMap, timestamp);
  }

  getLatestSnapshotPathForTargetMap(targetMap: string) {
    const timestamp = this.getLatestSnapshotTimestampForTargetMap(targetMap);

    return timestamp && this.getSnapshotPath(targetMap, timestamp);
  }

  updateSnapshotSymlinks() {
    // For atomicity
    const { existingSnapshotNamesByTargetMap } = this;

    Object.keys(existingSnapshotNamesByTargetMap).forEach((targetMap) => {
      const names = existingSnapshotNamesByTargetMap[targetMap];

      if (names.length === 0) {
        return;
      }

      // === initial

      const initial = names[0];

      const initialSnapshotSymlinkPath = this.getInitialSnapshotSymlinkPath(
        targetMap,
      );

      try {
        removeSync(initialSnapshotSymlinkPath);
      } catch (err) {
        // noop
      }

      symlinkSync(initial, initialSnapshotSymlinkPath);

      // === latest

      const latest = names[names.length - 1];

      const latestSnapshotSymlinkPath = this.getLatestSnapshotSymlinkPath(
        targetMap,
      );

      try {
        removeSync(latestSnapshotSymlinkPath);
      } catch (err) {
        // noop
      }

      symlinkSync(latest, latestSnapshotSymlinkPath);
    });
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

    const removedSnapshotsMetadataByTargetMap: Record<
      string,
      SnapshotMetadata[]
    > = {};

    this.existingSnapshotsMetadata.forEach((metadata) => {
      const { targetMap, snapshotPath } = metadata;

      if (timestampFilterFn(metadata)) {
        try {
          removeSync(snapshotPath);

          removedSnapshotsMetadataByTargetMap[targetMap] =
            removedSnapshotsMetadataByTargetMap[targetMap] || [];

          removedSnapshotsMetadataByTargetMap[targetMap].push(metadata);
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
      removedSnapshotsMetadataByTargetMap,
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
