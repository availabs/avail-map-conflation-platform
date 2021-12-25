export default function isValidNpmrdsShapefileVersion(
  npmrdsShapefileVerion: string,
) {
  return /^[a-z0-9_-]*[a-z]{2}-npmrds-shapefile-\d{4}-v\d{8}$/.test(
    npmrdsShapefileVerion,
  );
}
