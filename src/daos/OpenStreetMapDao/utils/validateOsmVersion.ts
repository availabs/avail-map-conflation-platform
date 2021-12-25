import { OsmVersion } from '../domain/types';

export default function validateOsmVersion(osmVersion: OsmVersion) {
  return /^[a-z0-9-_]+$/i.test(osmVersion);
}
