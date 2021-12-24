import _ from 'lodash';
import * as turf from '@turf/turf';

const getNRMSD = (reported: number[], computed: number[]) =>
  Math.sqrt(
    reported.reduce((acc, x, i) => {
      // @ts-ignore
      const y = computed[i];

      return acc + (x - y) ** 2;
    }, 0),
  ) / computed[computed.length - 1];

export default function getShapeDistancesTraveledUnits(
  shape: turf.Feature<turf.LineString>,
  shapeDistancesTraveled: number[],
): null | 'kilometers' | 'meters' | 'miles' | 'feet' {
  const computedShapeDistancesTraveledKm = turf.segmentReduce(
    shape,
    // @ts-ignore
    (acc: number[], curSeg: turf.Feature<turf.LineString>) => {
      const d = turf.length(curSeg, { units: 'kilometers' });

      const t = _.round(d + acc[acc.length - 1], 6);

      acc.push(t);

      return acc;
    },
    [0],
  );

  const shapeDistTravM = computedShapeDistancesTraveledKm.map((d) =>
    _.round(d * 1000, 6),
  );
  const shapeDistTravMi = computedShapeDistancesTraveledKm.map((d) =>
    _.round(d * 0.62137119, 6),
  );
  const shapeDistTravFt = shapeDistTravMi.map((d) => _.round(d * 5280, 6));

  const getNRMSDForReported = getNRMSD.bind(null, shapeDistancesTraveled);

  // Probably overkill.
  // Could just compare the last dist traveled,
  //   however then we depend entirely on a single (possibly anamalous) value
  // https://en.wikipedia.org/wiki/Root-mean-square_deviation#Normalization
  const nrmsdKm = {
    unit: 'kilometers',
    nrmsd: getNRMSDForReported(computedShapeDistancesTraveledKm),
  };

  const nrmsdM = {
    unit: 'meters',
    nrmsd: getNRMSDForReported(shapeDistTravM),
  };

  const nrmsdMi = {
    unit: 'miles',
    nrmsd: getNRMSDForReported(shapeDistTravMi),
  };

  const nrmsdFt = {
    unit: 'feet',
    nrmsd: getNRMSDForReported(shapeDistTravFt),
  };

  // @ts-ignore
  const shapeDistancesTraveledUnits = _.sortBy(
    [nrmsdKm, nrmsdM, nrmsdMi, nrmsdFt],
    'nrmsd',
  )[0].unit;

  // @ts-ignore
  return shapeDistancesTraveledUnits;
}
