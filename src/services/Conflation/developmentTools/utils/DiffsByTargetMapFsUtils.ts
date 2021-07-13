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

export type DiffMetadata = {
  targetMap: string;
  timestamps: [string, string];
  a_timestamp: string;
  b_timestamp: string;
  diffName: string;
  diffPath: string;
};

export default class DiffsByTargetMapFsUtils {
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

  static checkDiffTimestamps(a_timestamp: string, b_timestamp: string) {
    DiffsByTargetMapFsUtils.checkTimestamp(a_timestamp);
    DiffsByTargetMapFsUtils.checkTimestamp(b_timestamp);

    // NOTE: This invariant simplifies things
    if (!(a_timestamp < b_timestamp)) {
      throw new Error(`${a_timestamp} does not preceed ${b_timestamp}`);
    }
  }

  private dir: string;

  private nameCore: string;

  private ext: string;

  private extension: string;

  private diffNameRE: RegExp;

  private targetMapNameCaptureRE: RegExp;

  private timestampsCaptureRE: RegExp;

  readonly diffSymlinkNameRE: RegExp;

  private autoSymlinksDirWatcher!: FSWatcher | null;

  constructor({ dir, nameCore, ext, autoUpdateSymlinks }) {
    this.dir = dir;
    this.nameCore = nameCore;
    this.ext = ext;
    this.extension = this.ext ? `.${this.ext}` : '';

    const escapedNameCore = this.nameCore.replace(/\./g, '\\.');
    const targetMapPattern = '[a-z_]{1,}';
    const escapedExt = this.extension.replace(/\./g, '\\.');

    this.diffNameRE = new RegExp(
      `^${escapedNameCore}\\.${targetMapPattern}\\.\\d{10}-\\d{10}${escapedExt}$`,
    );

    this.targetMapNameCaptureRE = new RegExp(
      `^${escapedNameCore}\\.(${targetMapPattern})\\.\\d{10}-\\d{10}${escapedExt}$`,
    );

    this.timestampsCaptureRE = new RegExp(
      `^${escapedNameCore}\\.${targetMapPattern}\\.(\\d{10})-(\\d{10})${escapedExt}$`,
    );

    // FIXME: Need to change to latest-differential, latest-incremental
    this.diffSymlinkNameRE = new RegExp(
      `^${escapedNameCore}\\.${targetMapPattern}\\.(latest_differential|latest_incremental)${escapedExt}$`,
    );

    if (autoUpdateSymlinks === true) {
      mkdirSync(this.dir, { recursive: true });
      this.autoUpdateDiffSymlinks();
    } else {
      this.autoSymlinksDirWatcher = null;
    }
  }

  getDiffName(targetMap: string, [a_timestamp, b_timestamp]: [string, string]) {
    DiffsByTargetMapFsUtils.checkTargetMapName(targetMap);
    DiffsByTargetMapFsUtils.checkDiffTimestamps(a_timestamp, b_timestamp);

    return `${this.nameCore}.${targetMap}.${a_timestamp}-${b_timestamp}${this.extension}`;
  }

  getDiffPath(targetMap: string, timestamps: [string, string]) {
    return join(this.dir, this.getDiffName(targetMap, timestamps));
  }

  getLatestDifferentialDiffSymlinkName(targetMap: string) {
    return `${this.nameCore}.${targetMap}.latest_differential{this.extension}`;
  }

  getLatestDifferentialDiffSymlinkPath(targetMap: string) {
    return join(this.dir, this.getLatestDifferentialDiffSymlinkName(targetMap));
  }

  getLatestIncrementalDiffSymlinkName(targetMap: string) {
    return `${this.nameCore}.${targetMap}.latest_incremental{this.extension}`;
  }

  getLatestIncrementalDiffSymlinkPath(targetMap: string) {
    return join(this.dir, this.getLatestIncrementalDiffSymlinkName(targetMap));
  }

  parseDiffName(diffName: string): DiffMetadata {
    // @ts-ignore
    const [, targetMap] = diffName.match(this.targetMapNameCaptureRE) || [];
    const [, a_timestamp, b_timestamp] =
      diffName.match(this.timestampsCaptureRE) || [];

    if (!(targetMap && a_timestamp && b_timestamp)) {
      throw new Error(`invalid diff name ${diffName}`);
    }

    const timestamps: [string, string] = [a_timestamp, b_timestamp];

    const diffPath = this.getDiffPath(targetMap, timestamps);

    return {
      targetMap,
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
            (dirent) => dirent.isFile() && this.diffNameRE.test(dirent.name),
          )
          .map(({ name }) => name)
          .sort() // Assumes a_timestamp <= b_timestamp. File names in sorted order assumed elsewhere.
      : [];
  }

  get existingDiffsMetadata() {
    // NOTE: this.existingSnapshotNames filters out invalid names.
    //       Therefore, no need to worry about parse throwing.
    return this.existingDiffNames.map(this.parseDiffName.bind(this));
  }

  get existingDiffTimestampsByTargetMap() {
    return this.existingDiffsMetadata.reduce(
      (acc: Record<string, [string, string][]>, { targetMap, timestamps }) => {
        acc[targetMap] = acc[targetMap] || [];

        acc[targetMap].push(timestamps);

        return acc;
      },
      {},
    );
  }

  get existingDiffNamesByTargetMap() {
    return this.existingDiffsMetadata.reduce(
      (acc: Record<string, string[]>, { targetMap, diffName }) => {
        acc[targetMap] = acc[targetMap] || [];

        acc[targetMap].push(diffName);

        return acc;
      },
      {},
    );
  }

  get existingDiffPathsByTargetMap() {
    const timestampsByTargetMap = this.existingDiffTimestampsByTargetMap;

    return Object.keys(timestampsByTargetMap).reduce((acc, targetMap) => {
      acc[targetMap] = timestampsByTargetMap[targetMap].map((timestamps) =>
        this.getDiffPath(targetMap, timestamps),
      );

      return acc;
    }, {});
  }

  get targetMapsWithDiffs() {
    return _.uniq(this.existingDiffsMetadata.map(({ targetMap }) => targetMap));
  }

  get commonExistingTimestamps() {
    const { existingDiffTimestampsByTargetMap } = this;

    const targetMaps = Object.keys(existingDiffTimestampsByTargetMap);

    const tstamps = targetMaps.map(
      (tMap) => existingDiffTimestampsByTargetMap[tMap],
    );

    const commonTimestamps = _.intersectionWith(...tstamps, _.isEqual).sort(
      (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]),
    );

    return { targetMaps, commonTimestamps };
  }

  get latestDiffsMetadataByTargetMap() {
    const { existingDiffTimestampsByTargetMap } = this;

    return Object.keys(existingDiffTimestampsByTargetMap).reduce(
      (acc, targetMap) => {
        const allTimestampsForTargetMap = _(
          existingDiffTimestampsByTargetMap[targetMap],
        )
          .flattenDeep()
          .sort()
          .uniq()
          .value();

        const [initial] = allTimestampsForTargetMap;

        // NOTE: a_timestamp guaranteed < b_timestamp, therefore at least two unique.
        const [penult, latest] = allTimestampsForTargetMap.slice(-2);

        // === Differential Diff (initial, latest)

        const differentialDiffTimestamps: [string, string] = [initial, latest];

        const differentialDiffName = this.getDiffName(
          targetMap,
          differentialDiffTimestamps,
        );
        const differentialDiffPath = this.getDiffPath(
          targetMap,
          differentialDiffTimestamps,
        );

        const differentialExists = existsSync(differentialDiffPath);

        // === Incremental Diff (penult, latest)

        const incrementalDiffTimestamps: [string, string] = [penult, latest];

        const incrementalDiffName = this.getDiffName(
          targetMap,
          incrementalDiffTimestamps,
        );

        const incrementalDiffPath = this.getDiffPath(
          targetMap,
          incrementalDiffTimestamps,
        );

        const incrementalExists = existsSync(incrementalDiffPath);

        acc[targetMap] = {
          differential: {
            timestamps: differentialExists ? differentialDiffTimestamps : null,

            diffName: differentialExists ? differentialDiffName : null,

            diffPath: differentialExists ? differentialDiffPath : null,
          },

          incremental: {
            timestamps: incrementalExists ? incrementalDiffTimestamps : null,

            diffName: incrementalExists ? incrementalDiffName : null,

            diffPath: incrementalExists ? incrementalDiffPath : null,
          },
        };

        return acc;
      },
      {},
    );
  }

  get missingDiffsMetadataByTargetMap(): Record<
    string,
    {
      missingDifferentialDiffsMeta: DiffMetadata[];
      missingIncrementalDiffsMeta: DiffMetadata[];
    }
  > {
    const { existingDiffTimestampsByTargetMap } = this;

    return Object.keys(existingDiffTimestampsByTargetMap).reduce(
      (acc, targetMap) => {
        const allTimestampsForTargetMap = _(
          existingDiffTimestampsByTargetMap[targetMap],
        )
          .flattenDeep()
          .sort()
          .uniq()
          .value();

        const [initial] = allTimestampsForTargetMap;

        const missingDifferentialDiffsMeta = allTimestampsForTargetMap.reduce(
          (missingDifferentialMetaAcc: DiffMetadata[], b_timestamp, i) => {
            if (i === 0) {
              return missingDifferentialMetaAcc;
            }

            const timestamps: [string, string] = [initial, b_timestamp];

            const diffName = this.getDiffName(targetMap, timestamps);
            const diffPath = this.getDiffPath(targetMap, timestamps);

            if (!existsSync(diffPath)) {
              missingDifferentialMetaAcc.push({
                targetMap,
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

        const missingIncrementalDiffsMeta = allTimestampsForTargetMap
          .slice(1)
          .reduce(
            (missingIncrementalMetaAcc: DiffMetadata[], b_timestamp, i) => {
              const a_timestamp = allTimestampsForTargetMap[i];

              const timestamps: [string, string] = [a_timestamp, b_timestamp];

              const diffName = this.getDiffName(targetMap, timestamps);
              const diffPath = this.getDiffPath(targetMap, timestamps);

              if (!existsSync(diffPath)) {
                missingIncrementalMetaAcc.push({
                  targetMap,
                  a_timestamp,
                  b_timestamp,
                  timestamps,
                  diffName,
                  diffPath,
                });
              }

              return missingIncrementalMetaAcc;
            },
            [],
          );

        acc[targetMap] = {
          missingDifferentialDiffsMeta,
          missingIncrementalDiffsMeta,
        };

        return acc;
      },
      {},
    );
  }

  updateDiffSymlinks() {
    // For atomicity
    const { latestDiffsMetadataByTargetMap } = this;

    Object.keys(latestDiffsMetadataByTargetMap).forEach((targetMap) => {
      const differentialSymlinkPath = this.getLatestDifferentialDiffSymlinkPath(
        targetMap,
      );

      const incrementalSymlinkPath = this.getLatestIncrementalDiffSymlinkPath(
        targetMap,
      );

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
      } = latestDiffsMetadataByTargetMap[targetMap];

      if (differentialDiffName !== null) {
        symlinkSync(differentialDiffName, differentialSymlinkPath);
      }

      if (incrementalDiffName !== null) {
        symlinkSync(incrementalDiffName, incrementalSymlinkPath);
      }
    });
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
    if (!this.isAutoUpdatingDiffSymlinks) {
      return;
    }

    this?.autoSymlinksDirWatcher?.close();
    this.autoSymlinksDirWatcher = null;
  }

  removeDiffsByMetadataFilter(
    timestampFilterFn: (metadata: DiffMetadata) => boolean,
  ) {
    const { isAutoUpdatingDiffSymlinks } = this;

    if (isAutoUpdatingDiffSymlinks) {
      this.noAutoUpdateDiffSymlinks();
    }

    const removedDiffsMetadataByTargetMap: Record<string, DiffMetadata[]> = {};

    this.existingDiffsMetadata.forEach((metadata) => {
      const { targetMap, diffPath } = metadata;

      if (timestampFilterFn(metadata)) {
        try {
          removeSync(diffPath);

          removedDiffsMetadataByTargetMap[targetMap] =
            removedDiffsMetadataByTargetMap[targetMap] || [];

          removedDiffsMetadataByTargetMap[targetMap].push(metadata);
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

    const { missingDiffsMetadataByTargetMap } = this;

    return {
      removedDiffsMetadataByTargetMap,
      missingDiffsMetadataByTargetMap,
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
