import { NysTrafficCountStationsVersion } from '../domain/types';

export default function isValidNysTrafficCountStationsVersion(
  nysTrafficCountStationsVersion: NysTrafficCountStationsVersion,
) {
  return /^\d{8}$/.test(nysTrafficCountStationsVersion);
}
