import * as turf from '@turf/turf';

const BUFFER_SIZE = 0.001; // 1 meter

export default function getBufferPolygonCoords(
  feature: turf.Feature | turf.FeatureCollection,
  options = { bufferRadius: BUFFER_SIZE },
) {
  const { bufferRadius } = options;

  // @ts-ignore
  let b = turf.buffer(feature, bufferRadius, { units: 'kilometers' });

  let polyCoords = turf.getCoords(b);

  if (Array.isArray(polyCoords) && polyCoords.length > 1) {
    const convexHull = turf.convex(feature, { concavity: Infinity });

    b = turf.buffer(convexHull, bufferRadius, { units: 'kilometers' });

    polyCoords = turf.getCoords(b);
  }

  if (!Array.isArray(polyCoords) || polyCoords.length === 0) {
    throw new Error('Unable to create a bounding polygon for the feature.');
  }

  return polyCoords;
}
