import db from '../../../../services/DbService';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export default (
  xdb: any = db,
  { osmWayId, osmNodeIds = null, tags = null },
) => {
  xdb
    .prepare(
      `
        INSERT OR IGNORE INTO ${SCHEMA}.osm_ways (
          osm_way_id,
          osm_node_ids,
          tags
        ) VALUES (?, ?, ?) ; `,
    )
    .run([
      osmWayId,
      osmNodeIds && JSON.stringify(osmNodeIds),
      tags && JSON.stringify(tags),
    ]);
};
