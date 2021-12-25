import isValidTmcIdentificationVersion from './isValidTmcIdentificationVersion';

export default function parseTmcIdentificationVersion(
  tmc_identification_version: string,
) {
  if (!isValidTmcIdentificationVersion(tmc_identification_version)) {
    throw new Error(
      'Cannot parse the TMC_Identification version using the conventions are set by the https://github.com/availabs/NPMRDS_Database ETL process.',
    );
  }

  // @ts-ignore
  const year: number = tmc_identification_version
    .match(/_\d{4}_/)?.[0]
    .replace(/[^0-9]/g, '');

  return {
    year,
  };
}
