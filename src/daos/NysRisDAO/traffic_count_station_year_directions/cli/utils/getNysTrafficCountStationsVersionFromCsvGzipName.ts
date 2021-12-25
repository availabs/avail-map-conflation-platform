import { basename } from 'path';

export default function getNysRisVersionFromPbfFileName(
  nysTrafficCountStationsCsvGzipName: string,
) {
  const b = basename(nysTrafficCountStationsCsvGzipName);

  if (!/^nys-traffic-counts-station-year-directions-\d{8}.csv.gz$/.test(b)) {
    return null;
  }

  return b.replace(/\.csv\.gz$/, '');
}
