#!/usr/bin/env node

/* eslint no-continue: 0 */

import { join, isAbsolute } from 'path';
import { execSync } from 'child_process';
import { existsSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { fileSync as tmpFileSync, dirSync as tmpDirSync } from 'tmp';

import { padStart } from 'lodash';

import yargs from 'yargs';
import { sync as rimrafSync } from 'rimraf';

import YEARS from './YEARS';
import REGIONS from './REGIONS';
import TABLES from './TABLES';

import getDataFileName from './getDataFileName';

const getYYYYMMDD = () => {
  const date = new Date();

  const yyyy = date.getFullYear();
  const mm = `0${date.getMonth() + 1}`.slice(-2);
  const dd = `0${date.getDate()}`.slice(-2);

  return `${yyyy}${mm}${dd}`;
};

const yargsSpec = {
  years: {
    alias: 'year',
    type: 'array',
    demand: false,
    choices: YEARS,
    default: YEARS,
  },
  regions: {
    alias: 'region',
    type: 'array',
    demand: false,
    choices: REGIONS,
    default: REGIONS,
  },
  tables: {
    alias: 'table',
    type: 'array',
    demand: false,
    choices: TABLES,
    default: TABLES,
  },
  downloadDir: {
    type: 'string',
    demand: false,
    default: join(
      process.cwd(),
      `highway_data_service_counts_scrape.${getYYYYMMDD()}/`,
    ),
  },
};

const urlPath =
  'https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb/repository';

// Sed program for cleaning up the downloaded CSVs
const sedProgram =
  // Trim whitespace from the columns.
  's/ *, */,/g; ' +
  // Remove Windows line endings.
  's/\r//; ' +
  // Empty strings to null
  's/^" *",/,/; s/," *",/,,/g; s/" *"$//' +
  // Fix the columns where either side of an '/' are many whitespaces apart.
  's# */ *# / #g; ' +
  // Delete the "row selected" lines from the CSV
  '/rows selected/d; ' +
  // Some CSVs had a line with ---,---,
  //   So we delete rows that have no alpha-numeric characters
  '/[A-Za-Z0-9]/!d';

const getURLDocumentName = (table: string, region: string, year: number) => {
  // === AVGWD ===
  if (table === 'average_weekday_speed') {
    return year <= 2017
      ? `SC_Speed_AVGWD_R${padStart(region, 2, '0')}_${year}.zip`
      : `SC_SPEED_AVGWD_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  if (table === 'average_weekday_vehicle_classification') {
    return `SC_CLASS_AVGWD_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  if (table === 'average_weekday_volume') {
    return `SC_Volume_AVGWD_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  // === CC ===
  if (table === 'continuous_vehicle_classification') {
    return year <= 2015
      ? `CC_CLASS_R${region}_${year}.zip`
      : `CC_Class_Data_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  if (table === 'continuous_volume') {
    return year <= 2015
      ? `CC_VOL_R${region}_${year}.zip`
      : `CC_Volume_Data_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  // === SC ===
  if (table === 'short_count_speed') {
    return year <= 2017
      ? `SC_Speed_Data_R${padStart(region, 2, '0')}_${year}.zip`
      : `SC_SPEED_DATA_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  if (table === 'short_count_vehicle_classification') {
    return year <= 2017
      ? `SC_Class_Data_R${padStart(region, 2, '0')}_${year}.zip`
      : `SC_CLASS_DATA_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  if (table === 'short_count_volume') {
    return year <= 2017
      ? `SC_Volume_Data_R${padStart(region, 2, '0')}_${year}.zip`
      : `SC_VOLUME_DATA_R${padStart(region, 2, '0')}_${year}.zip`;
  }

  throw new Error('Unrecognized table name');
};

// https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb
const main = (argv) => {
  const { years, regions, tables, downloadDir } = argv;

  const downloadDirAbsPath = isAbsolute(downloadDir)
    ? downloadDir
    : join(process.cwd(), downloadDir);

  mkdirSync(downloadDirAbsPath, { recursive: true });

  for (let i = 0; i < years.length; ++i) {
    const year = years[i];

    for (let j = 0; j < regions.length; j += 1) {
      const region = regions[j];

      for (let k = 0; k < tables.length; ++k) {
        const table = tables[k];

        if (year === 2016 && /^continuous/.test(table)) {
          console.error(`Skipping ${table} for ${year}`);
          continue;
        }

        const outputFileName = getDataFileName(table, region, year);
        const outputFilePath = join(downloadDirAbsPath, outputFileName);

        const urlDocumentName = getURLDocumentName(table, region, year);
        const url = `${urlPath}/${urlDocumentName}`;

        const { name: tmpDirName } = tmpDirSync();

        const zipFilePath = join(tmpDirName, urlDocumentName);
        console.log(url, zipFilePath);

        try {
          // Download the archive
          execSync(
            `
              curl -k -o '${zipFilePath}' '${url}';
              unzip '${zipFilePath}';
              rm -f '${zipFilePath}';
            `,
            {
              cwd: tmpDirName,
              stdio: [null, null, null],
            },
          );

          // Get the name of the extracted CSV.
          const dotCSVFileName = readdirSync(tmpDirName).filter((f) =>
            f.match(/csv$/i),
          )[0];

          // Clean the extracted CSV (in place)
          // Remove duplicate rows to fix the problem of the header showing up at the beginning and the end of a file.
          // https://stackoverflow.com/a/20639730/3970755
          // Put the cleaned output into a temporary file
          // Move the cleaned CSV to the output dir with the canonical name
          const { name: tmpFileName } = tmpFileSync({ dir: tmpDirName });
          execSync(
            `
            sed -i '${sedProgram}' '${dotCSVFileName}';
            cat -n '${dotCSVFileName}' | sort -uk2 | sort -nk1 | cut -f2- > ${tmpFileName};
            mv ${tmpFileName} '${outputFilePath}';
          `,
            {
              cwd: tmpDirName,
              stdio: [null, null, null],
            },
          );

          // Compress the CSV
          execSync(`gzip -f -9 '${outputFilePath}'`, {
            cwd: downloadDirAbsPath,
          });
        } catch (err) {
          // If we encountered an error, remove the output file if it exists
          if (existsSync(outputFilePath)) {
            unlinkSync(outputFilePath);
          }
        } finally {
          // Delete the tmp work dir
          rimrafSync(tmpDirName);
        }
      }
    }
  }
};

if (require.main === module) {
  const { argv } = yargs
    .strict()
    .parserConfiguration({
      'camel-case-expansion': false,
      'flatten-duplicate-arrays': true,
    })
    .wrap(yargs.terminalWidth() / 1.618)
    .option(yargsSpec);

  main(argv);
}

module.exports = {
  yargsSpec,
  main,
};
