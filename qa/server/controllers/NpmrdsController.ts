import * as turf from '@turf/turf'

import TargetMapController from './TargetMapController';

import {NpmrdsTmcFeature} from '../../../src/daos/NpmrdsDAO/raw_map_layer/domain/types'
import rawEdgeIsUnidirectional from '../../../src/daos/NpmrdsDAO/target_map_layer/utils/rawEdgeIsUnidirectional'

import {NPMRDS} from '../../../src/constants/databaseSchemaNames';

class NpmrdsTargetMapController extends TargetMapController<NpmrdsTmcFeature> {
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

export default new NpmrdsTargetMapController(NPMRDS);
