import * as turf from '@turf/turf'

import TargetMapController from './TargetMapController';

import {NysRoadInventorySystemFeature} from '../../../src/daos/NysRisDAO/raw_map_layer/domain/types'
import rawEdgeIsUnidirectional from '../../../src/daos/NysRisDAO/target_map_layer/utils/rawEdgeIsUnidirectional'

import {NYS_RIS} from '../../../src/constants/databaseSchemaNames';

class NysRisTargetMapController extends TargetMapController<NysRoadInventorySystemFeature> {
  getRawTargetMapFeatureProperties() {
    const rawTargetMapFeatureProperties = this.allRawTargetMapFeatures.map(feature => {
      return {
        ...feature.properties,
        id: feature.id,
        featureLengthKm: turf.length(feature),
        isUnidirectional: rawEdgeIsUnidirectional(feature)
      }
    })

    return rawTargetMapFeatureProperties
  }
}

export default new NysRisTargetMapController(NYS_RIS);
