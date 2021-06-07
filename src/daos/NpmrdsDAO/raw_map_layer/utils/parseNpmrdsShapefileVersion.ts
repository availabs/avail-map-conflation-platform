import isValidNpmrdsShapefileVersion from './isValidNpmrdsShapefileVersion';

export default function parseNpmrdsShapefileVersion(
  npmrds_shapefile_version: string,
) {
  if (!isValidNpmrdsShapefileVersion(npmrds_shapefile_version)) {
    throw new Error(
      'Cannot parse the NPMRDS Shapefile version. Naming conventions are set in https://github.com/availabs/avail-gis-toolkit',
    );
  }

  // @ts-ignore
  const year: number = npmrds_shapefile_version
    .match(/npmrds-shapefile-\d{4}-v\d{8}$/)?.[0]
    .replace(/.*npmrds-shapefile-/, '')
    .replace(/-v\d{8}/, '');

  const extractArea =
    npmrds_shapefile_version
      .match(/[a-z-_]{1,}-npmrds-shapefile-\d{4}-v\d{8}$/)?.[0]
      .replace(/-npmrds-shapefile-\d{4}-v\d{8}$/, '') || null;

  return {
    year,
    extractArea,
  };
}
