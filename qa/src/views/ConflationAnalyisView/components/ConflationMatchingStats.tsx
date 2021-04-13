// MapController

import React from "react"

import _ from 'lodash'

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

  const showUnmatched = layer.showTargetMapUnmatchedSegments.bind(layer)
  const filter = layer.showTargetMapMatchedSegmentsInLengthDifferenceRange.bind(layer)
  const showSetDifference = layer.showSetDifferenceTargetMapSegments.bind(layer)

  return (
    <div>
      <div style={{display: 'flex', paddingBottom: 15}}>
        <div style={{flex: 1, textAlign: 'center', cursor: 'pointer'}}>
          <div>Both Direction Matches</div>
        </div>
      </div>

      <div
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => layer.showingUnmatched ? filter(-Infinity, Infinity) : showUnmatched()}
      >
        <div style={{flex: 1, textAlign: 'center', cursor: 'pointer'}}>
          <span>% Matching </span>
            <div style={divStyle}>
              {((matchingStats.matchedR) * 100).toFixed(1)}
            </div>
        </div>
      </div>

      <div style={{display: 'flex', paddingBottom: 15}}>
        <div
          style={{flex: '8', textAlign: 'center', cursor: 'pointer'}}
          onClick={() => layer.minLenDiff === matchingStats.matchedMeanLenDiffKm && layer.maxLenDiff === Infinity
            ? showSetDifference()
            : filter(matchingStats.matchedMeanLenDiffKm, Infinity)
          }
        >
          <div>Mean Δ</div>
          <div style={divStyle}> {_.round(matchingStats.matchedMeanLenDiffKm * 1000)} m</div>
        </div>

        <div
          style={{flex: '8', textAlign: 'center', cursor: 'pointer'}}
          onClick={() => layer.minLenDiff === matchingStats.matchedMedianLenDiffKm && layer.maxLenDiff === Infinity
            ? showSetDifference()
            : filter(matchingStats.matchedMedianLenDiffKm, Infinity)
          }
        >
          <div>Median Δ</div>
          <div style={divStyle}>{_.round(matchingStats.matchedMedianLenDiffKm * 1000)} m</div>
        </div>
      </div>

      <div
        style={{display: 'flex', paddingBottom: 15, cursor: 'pointer'}}
        onClick={() => layer.minLenDiff === 0 && layer.maxLenDiff === 0.005
          ? showSetDifference()
          : filter(0, 0.005)
        }
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
        onClick={() => layer.minLenDiff === 0.005 && layer.maxLenDiff === 0.01
          ? showSetDifference()
          : filter(0.005, 0.01)
        }
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
        onClick={() => layer.minLenDiff === 0.01 && layer.maxLenDiff === 0.025
          ? showSetDifference()
          : filter(0.01, 0.025)
        }
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
        onClick={() => layer.minLenDiff === 0.025 && layer.maxLenDiff === 0.05
          ? showSetDifference()
          : filter(0.025, 0.05)
        }
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
        onClick={() => layer.minLenDiff === 0.05 && layer.maxLenDiff === 0.1
          ? showSetDifference()
          : filter(0.05, 0.1)
        }
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
        onClick={() => layer.minLenDiff === 0.1 && layer.maxLenDiff === Infinity
          ? showSetDifference()
          : filter(0.1, Infinity)
        }
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
