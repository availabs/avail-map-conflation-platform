/* eslint-disable no-restricted-syntax, no-continue, no-loop-func */

import _ from 'lodash';
import * as turf from '@turf/turf';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain';

const GAP_THRESHOLD_KM = 0.003; // ~10ft

/*
{
    "discontinuities": [
        [
            "100862011:3.19",
            "100862011:3.85"
        ],
        [
            "100862011:3.85",
            "100862011:5.75"
        ]
    ]
}
*/

export default function findMesoLevelPaths(
  nysRoadInventorySystemFeatures: NysRoadInventorySystemFeature[],
): NysRoadInventorySystemFeature['id'][][] {
  if (nysRoadInventorySystemFeatures.length === 1) {
    return [[nysRoadInventorySystemFeatures[0].id]];
  }

  const orderedFeatures: NysRoadInventorySystemFeature[] = _.sortBy(
    nysRoadInventorySystemFeatures,
    'properties.beg_mp',
  );

  const paths = orderedFeatures.slice(1).reduce(
    (acc, curFeature, i) => {
      const prevFeature = orderedFeatures[i];

      const curId = curFeature.id;

      console.log(curId);

      const prevEndPt = turf.point(
        // @ts-ignore
        _(turf.getCoords(prevFeature)).flattenDeep().chunk(2).last(),
      );

      const curBegPt = turf.point(
        // @ts-ignore
        _(turf.getCoords(curFeature)).flattenDeep().chunk(2).first(),
      );

      const dist = turf.distance(prevEndPt, curBegPt);

      console.log(dist);

      if (dist <= GAP_THRESHOLD_KM) {
        acc[acc.length - 1].push(curId);
      } else {
        acc.push([curId]);
      }

      return acc;
    },
    [[orderedFeatures[0].id]],
  );

  return paths;
}
