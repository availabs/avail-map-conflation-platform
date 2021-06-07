import isValidNysRisVersion from './isValidNysRisVersion';

export default function parseNysRisVersion(nys_ris_version: string) {
  if (!isValidNysRisVersion(nys_ris_version)) {
    throw new Error(
      'Cannot parse the NYS RIS version. Naming conventions are set in https://github.com/availabs/avail-gis-toolkit',
    );
  }

  // @ts-ignore
  const extractArea =
    nys_ris_version
      .match(/[a-z-_]{1,}_nys-roadway-inventory-system-\d{8}$/)?.[0]
      .replace(/_nys-roadway-inventory-system-\d{8}$/, '') || null;

  return {
    extractArea,
  };
}
