import React, {useState, useEffect, useRef} from 'react';

import _ from 'lodash'

import { ConflationAnalysisLayer } from '../layers/ConflationLayerFactory'

// https://github.com/cssinjs/jss/issues/1344#issuecomment-734402215
const divStyle: React.CSSProperties = {
  fontSize: '3em',
  fontWeight: 500,
  padding: 5
}

export default ({layer}: {layer: ConflationAnalysisLayer}) => {
  const [selectedTargetMapId, setSelectedTargetMapId] = useState(layer.selectedTargetMapId);

  useEffect(() => {
    layer.selectedTargetMapIdChangeEmitter.on('update', setSelectedTargetMapId)
        
    return () => {
      layer.selectedTargetMapIdChangeEmitter.off('update', setSelectedTargetMapId)
    }
  }, []);

  const conflationMetrics = layer.conflationAnalysis.getConflationMetrics(selectedTargetMapId ?? -1)

  return (
    <div style={{backgroundColor: '#fff', padding: 15}}>
      <div style={{display: 'flex', paddingBottom: 15}}>
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>Selected TargetMapEdge Id</div>
          <div style={divStyle}>
            {selectedTargetMapId}
          </div>
        </div>
      </div>

      <div style={{display: 'flex', paddingBottom: 15}}>
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>Target Map Edge Length</div>
          <div style={divStyle}>
            {conflationMetrics ? `${_.round(conflationMetrics.targetMapEdgeLength * 1000)}m` : null}
          </div>
        </div>
      </div>

      <div style={{display: 'flex', paddingBottom: 15}}>
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>Target Map Edge Is Unidirectional</div>
          <div style={divStyle}>
            {conflationMetrics ? `${!!conflationMetrics.isUnidirectional}` : null}
          </div>
        </div>
      </div>

      <div style={{flex: 1, textAlign: 'center'}}>
        <div>Conflation Map Edges Total Length</div>
      </div>

      <div style={{display: 'flex', paddingBottom: 15}}>

        <div style={{flex: '8', textAlign: 'center'}} >
          <div>Forward</div>
          <div style={divStyle}>
            {
              conflationMetrics
                ? `${_.round((conflationMetrics.forwardConflationSegmentsLengthSum || 0) * 1000)}m`
                : null
            }
          </div>
        </div>

        <div style={{flex: '8', textAlign: 'center'}} >
          <div>Backward</div>
          <div style={divStyle}>
            {
              conflationMetrics
                ? `${_.round((conflationMetrics.backwardConflationSegmentsLengthSum || 0) * 1000)}m`
                : null
            }
          </div>
        </div>
      </div>
    </div>
  )
}
