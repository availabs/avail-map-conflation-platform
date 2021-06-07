export default function isValidTmcIdentificationVersion(
  tmcIdentificationVersion: string,
) {
  return /^tmc_identification_\d{4}_v\d{8}$/.test(tmcIdentificationVersion);
}
