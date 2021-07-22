/* eslint-disable no-restricted-syntax, no-await-in-loop */

import TargetMapDao, {
  TargetMapSchema,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import matchTargetMapPathEdges from './utils/matchTargetMapPath';

export default function* createOsrmMatchesIterator(
  targetMapSchema: TargetMapSchema,
) {
  const dao = new TargetMapDao(targetMapSchema);

  const iter = dao.makeTargetMapPathEdgesIterator();

  for (const { targetMapPathId, targetMapPathEdges } of iter) {
    yield {
      targetMapPathId,
      ...matchTargetMapPathEdges(targetMapPathEdges),
    };
  }
}
