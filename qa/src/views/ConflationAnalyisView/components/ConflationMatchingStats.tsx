// MapController

import React, {useState, useEffect} from 'react';

import _ from 'lodash'

import { ConflationAnalysisLayer } from '../layers/ConflationLayerFactory'

// https://github.com/cssinjs/jss/issues/1344#issuecomment-734402215
const divStyle: React.CSSProperties = {
  fontSize: '3em',
  fontWeight: 500,
  padding: 5
}

enum MatchFilter {
  matched,
  gteMean,
  gteMedian,
  lt5m,
  gte5mLt10m,
  gte10mLt25m,
  gte25mLt50m,
  gte50mLt100m,
  gte100m
}

const getMatchingStatsTable = (layer: ConflationAnalysisLayer) => 
  function (){
    const [activeFilter, setActiveFilter]: [MatchFilter | null, Function]= useState(null);
    const [showingSetDifference, setShowingSetDifference]: [boolean|null, Function] = useState(null);

    const conflationAnalysis = layer.conflationAnalysis
    const { matchingStats } = conflationAnalysis

    const showUnmatched = () => {
      setShowingSetDifference(true)
      layer.showTargetMapUnmatchedSegments()
    }

    const filter = (minLenDiff: number, maxLenDiff: number, filterName: MatchFilter) => {
      setShowingSetDifference(false)
      setActiveFilter(filterName)

      layer.showTargetMapMatchedSegmentsInLengthDifferenceRange(minLenDiff, maxLenDiff)
    }

    const showSetDifference = () => {
      setShowingSetDifference(true)

      layer.showSetDifferenceTargetMapSegments()
    }

    useEffect(() => {
      filter(-Infinity, Infinity, MatchFilter.matched)
    }, []);

    const borderColor = showingSetDifference ? 'crimson' : 'cornflowerblue'

    return (
      <div>
        <div style={{display: 'flex', paddingBottom: 15}}>
          <div style={{flex: 1, textAlign: 'center', cursor: 'pointer'}}>
            <div>Both Direction Matches</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            paddingBottom: 15,
            cursor: 'pointer',
            borderStyle: activeFilter === MatchFilter.matched ? 'solid' : 'hidden',
            borderColor
          }}
          onClick={() => (activeFilter === MatchFilter.matched && !showingSetDifference)
            ? showUnmatched()
            : filter(-Infinity, Infinity, MatchFilter.matched)
          }
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
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.gteMean ? 'solid' : 'hidden',
              borderColor
             }}

            onClick={() => (activeFilter === MatchFilter.gteMean && !showingSetDifference)
              ? showSetDifference()
              : filter(matchingStats.matchedMeanLenDiffKm, Infinity, MatchFilter.gteMean)
            }
          >
            <div>Mean Δ</div>
            <div style={divStyle}> {_.round(matchingStats.matchedMeanLenDiffKm * 1000)} m</div>
          </div>

          <div
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.gteMedian ? 'solid' : 'hidden',
              borderColor
            }}
            onClick={() => (activeFilter === MatchFilter.gteMedian && !showingSetDifference)
              ? showSetDifference()
              : filter(matchingStats.matchedMedianLenDiffKm, Infinity, MatchFilter.gteMedian)
            }
          >
            <div>Median Δ</div>
            <div style={divStyle}>{_.round(matchingStats.matchedMedianLenDiffKm * 1000)} m</div>
          </div>
        </div>

        <div
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.lt5m ? 'solid' : 'hidden',
              borderColor
            }}
            onClick={() => (activeFilter === MatchFilter.lt5m && !showingSetDifference)
              ? showSetDifference()
              : filter(0, 0.005, MatchFilter.lt5m)
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
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.gte5mLt10m ? 'solid' : 'hidden',
              borderColor
            }}
            onClick={() => (activeFilter === MatchFilter.gte5mLt10m && !showingSetDifference)
              ? showSetDifference()
              : filter(0.005, 0.01, MatchFilter.gte5mLt10m)
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
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.gte10mLt25m ? 'solid' : 'hidden',
              borderColor
            }}
            onClick={() => (activeFilter === MatchFilter.gte10mLt25m && !showingSetDifference)
              ? showSetDifference()
              : filter(0.01, 0.025, MatchFilter.gte10mLt25m)
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
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.gte25mLt50m ? 'solid' : 'hidden',
              borderColor
            }}
            onClick={() => (activeFilter === MatchFilter.gte25mLt50m && !showingSetDifference)
              ? showSetDifference()
              : filter(0.025, 0.05, MatchFilter.gte25mLt50m)
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
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.gte50mLt100m ? 'solid' : 'hidden',
              borderColor
            }}
            onClick={() => (activeFilter === MatchFilter.gte50mLt100m && !showingSetDifference)
              ? showSetDifference()
              : filter(0.05, 0.1, MatchFilter.gte50mLt100m)
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
            style={{
              flex: '8',
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: activeFilter === MatchFilter.gte100m ? 'solid' : 'hidden',
              borderColor
            }}
            onClick={() => (activeFilter === MatchFilter.gte100m && !showingSetDifference)
              ? showSetDifference()
              : filter(0.1, Infinity, MatchFilter.gte100m)
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
      {getMatchingStatsTable(layer)()}
    </div>
  </div>
)
