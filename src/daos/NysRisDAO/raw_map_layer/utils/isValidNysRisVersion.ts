import { NysRisVersion } from '../domain/types';

export default function isValidNysRisVersion(nysRisVersion: NysRisVersion) {
  return /^[a-z0-9_-]*nys-roadway-inventory-system-\d{8}$/.test(nysRisVersion);
}
