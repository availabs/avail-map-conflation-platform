import { NysRoadInventorySystemFeature } from '../../raw_map_layer/domain/types';

export default function rawEdgeIsUnidirectional(
  feature: NysRoadInventorySystemFeature,
) {
  const {
    properties: { oneway, divided, total_lanes, primary_dir_lanes },
  } = feature;

  return (
    oneway === 'Y' || (divided === 'Y' && total_lanes === primary_dir_lanes)
  );
}
