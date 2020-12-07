/* eslint-disable no-restricted-syntax, no-continue, no-loop-func */

import _ from 'lodash';

import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain';

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

      const prevEndMp = prevFeature.properties.end_mp;
      const curBegMp = curFeature.properties.beg_mp;

      if (prevEndMp === curBegMp) {
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
