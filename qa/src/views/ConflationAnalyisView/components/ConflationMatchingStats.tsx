// MapController

import React from "react"

import _ from 'lodash'

import { ConflationAnalysis } from '../store/ConflationAnalysisFactory'
import { ConflationAnalysisLayer } from '../layers/ConflationLayerFactory'

// https://github.com/cssinjs/jss/issues/1344#issuecomment-734402215
const divStyle: React.CSSProperties = {
  fontSize: '3em',
  fontWeight: 500,
  padding: 5
}

const getMatchingStatsTable = (layer: ConflationAnalysisLayer) => {
  const conflationAnalysis = layer.conflationAnalysis
  const { matchingStats } = conflationAnalysis

  const filter = layer.showTargetMapFowardMatchedSegmentsInLengthDifferenceRange.bind(layer)

  return (
    <div>
      <div style={{display: 'flex', paddingBottom: 15}}>
        <div style={{flex: 1, textAlign: 'center', cursor: 'pointer'}}>
          <div>Both Direction Matches</div>
        </div>
      </div>

      <div style={{display: 'flex', paddingBottom: 15}}>
        <div style={{flex: 1, textAlign: 'center', cursor: 'pointer'}}>
          <span>% Matching </span>
            <div style={divStyle}>
              {((matchingStats.matchedR) * 100).toFixed(1)}
            </div>
        </div>
      </div>

      <div style={{display: 'flex', paddingBottom: 15}}>
        <div style={{flex: '8', textAlign: 'center'}}>
          <div>Mean Δ</div>
          <div style={divStyle}> {_.round(matchingStats.matchedMeanLenDiffKm * 1000)} m</div>
        </div>

        <div style={{flex: '8', textAlign: 'center'}}>
          <div>Median Δ</div>
          <div style={divStyle}>{_.round(matchingStats.matchedMedianLenDiffKm * 1000)} m</div>
        </div>
      </div>

      <div 
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => filter(0, 0.005)}
      >
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>{'Δ < 5m'}</div>
          <div style={divStyle}>
            {_.round(matchingStats.matchedLt5mR * 100, 2)}%
          </div>
        </div>
      </div>

      <div 
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => filter(0.005, 0.01)}
      >
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>{'5m ≤ Δ < 10m'}</div>
          <div style={divStyle}>
            {_.round(matchingStats.matchedGte5mLt10mR * 100, 2)}%
          </div>
        </div>
      </div>

      <div 
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => filter(0.01, 0.025)}
      >
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>{'10m ≤ Δ < 25m'}</div>
          <div style={divStyle}>
            {_.round(matchingStats.matchedGte10mLt25mR * 100, 2)}%
          </div>
        </div>
      </div>

      <div 
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => filter(0.025, 0.05)}
      >
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>{'25m < Δ ≤ 50m'}</div>
          <div style={divStyle}>
            {_.round(matchingStats.matchedGte25mLt50mR * 100, 2)}%
          </div>
        </div>
      </div>

      <div 
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => filter(0.05, 0.1)}
      >
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>{'50m ≤ Δ < 100m'}</div>
          <div style={divStyle}>
            {_.round(matchingStats.matchedGte50mLt100mR * 100, 2)}%
          </div>
        </div>
      </div>

      <div 
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => filter(0.1, Infinity)}
      >
        <div style={{flex: 1, textAlign: 'center'}}>
          <div>{'100m ≤ Δ'}</div>
          <div style={divStyle}>
            {_.round(matchingStats.matchedGte100mR * 100, 2)}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default ({layer}: {layer: ConflationAnalysisLayer}) => (
  <div style={{backgroundColor: '#fff', padding: 15}}>
    <div>
      {getMatchingStatsTable(layer)}
    </div>
  </div>
)
