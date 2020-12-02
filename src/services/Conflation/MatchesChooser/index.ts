import computeSubGraphComponentsTraversals from './computeSubGraphComponentsTraversals';
import chooseTargetMapPathShstMatches from './chooseTargetMapPathShstMatches';

import { TargetMapPathMatches } from '../../../utils/TargetMapDatabases/TargetMapDAO';

//  The targetMapPathMatches data structure:
//    [
//      {
//        targetMapPathEdge: <GeoJSON feature for the GTFS shape segment.>,
//        shstMatches: [...shst match GeoJSON features for the GTFS shape segment.]
//      },
//      ...
//    ]
export default function chooseTargetMapPathMatches(
  targetMapPathMatches: TargetMapPathMatches,
) {
  const subGraphComponentsTraversals = computeSubGraphComponentsTraversals(
    targetMapPathMatches,
  );

  const chosenPaths =
    chooseTargetMapPathShstMatches({
      targetMapPathMatches,
      subGraphComponentsTraversals,
    }) || {};

  return chosenPaths;
}
