/* eslint-disable no-restricted-syntax, no-await-in-loop */

import _ from 'lodash';

// import { NPMRDS as SCHEMA } from '../../../../../constants/databaseSchemaNames';
import { NYS_RIS as SCHEMA } from '../../../../../constants/databaseSchemaNames';

import TargetMapDao from '../../../../../utils/TargetMapDatabases/TargetMapDAO';

import GeoPackageWriter from '../../../developmentTools/conflationSpatial/utils/GeoPackageWriter';

import matchTargetMapPath from './matchTargetMapPath';

const tmDao = new TargetMapDao(SCHEMA);

// // Albany Rt 32 (Vine Street) is pathId 16
// // Albany Rt 85 is pathId 37
// // Albany I90 Westbound is pathId 47
const PATH_ID = null;

const tMPathsWriter =
  PATH_ID === null
    ? new GeoPackageWriter(`target_map_path_${SCHEMA}`)
    : new GeoPackageWriter(`target_map_path_${SCHEMA}_${PATH_ID}`);

const matchedShstRefsWriter =
  PATH_ID === null
    ? new GeoPackageWriter(`shst_references_${SCHEMA}`)
    : new GeoPackageWriter(`shst_references_${SCHEMA}_${PATH_ID}`);

const seenShstRefs = new Set();

(async () => {
  let iter: any;

  if (PATH_ID === null) {
    iter = tmDao.makeTargetMapPathEdgesIterator();
  } else {
    iter = [
      {
        targetMapPathId: PATH_ID,
        targetMapPathEdges: tmDao.getTargetMapPathEdges(PATH_ID),
      },
    ];
  }

  // const pathId = 32;
  // const pathEdges = tmDao.getTargetMapPathEdges(pathId);
  // const iter = [{ targetMapPathId: pathId, targetMapPathEdges: pathEdges }];

  for (const { targetMapPathId, targetMapPathEdges } of iter) {
    tMPathsWriter.write(
      TargetMapDao.mergeTargetMapPathEdges(targetMapPathId, targetMapPathEdges),
    );

    const { forward, backward } = await matchTargetMapPath(targetMapPathEdges);

    _.flattenDeep(forward)
      ?.filter(Boolean)
      .forEach((s) => {
        const { id } = s;
        if (!seenShstRefs.has(id)) {
          matchedShstRefsWriter.write(s);
          seenShstRefs.add(id);
        }
      });

    _.flattenDeep(backward)
      ?.filter(Boolean)
      .forEach((s) => {
        const { id } = s;
        if (!seenShstRefs.has(id)) {
          matchedShstRefsWriter.write(s);
          seenShstRefs.add(id);
        }
      });
  }

  matchedShstRefsWriter.close();
  tMPathsWriter.close();
})();
