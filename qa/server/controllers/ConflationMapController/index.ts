/* eslint-disable no-restricted-syntax */

import _ from 'lodash'

import ConflationMapDAO from '../../../../src/daos/ConflationMapDAO';

export class ConflationMapController {
  private dao: ConflationMapDAO;

  constructor() {
    this.dao = new ConflationMapDAO()
  }

  getConflationMappings(targetMap: 'nys_ris' | 'npmrds') {
    if (targetMap === 'nys_ris') {
      return this.dao.nysRisConflationMappings
    }

    if (targetMap === 'npmrds') {
      return this.dao.npmrdsConflationMappings
    }

    throw new Error(`Unrecognized TargetMap: ${targetMap}. Valid TargetMaps are 'nys_ris' and 'npmrds'.`)
  }

  getConflationMetrics(targetMap: 'nys_ris' | 'npmrds') {
    if (targetMap === 'nys_ris') {
      return this.dao.nysRisConflationMetrics
    }

    if (targetMap === 'npmrds') {
      return this.dao.npmrdsConflationMetrics
    }

    throw new Error(`Unrecognized TargetMap: ${targetMap}. Valid TargetMaps are 'nys_ris' and 'npmrds'.`)
  }
}

export default new ConflationMapController()
