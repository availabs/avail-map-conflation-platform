import db from '../../../../services/DbService';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

export default (xdb: any = db, { osmNodeId, lon, lat, tags = null }) =>
  xdb
    .prepare(
      `
        INSERT OR IGNORE INTO ${SCHEMA}.osm_nodes (
          osm_node_id,
          coord,
          tags
        ) VALUES (?, ?, ?) ; `,
    )
    .run([osmNodeId, JSON.stringify([lon, lat]), tags && JSON.stringify(tags)]);
