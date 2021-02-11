// MapController

import React from "react"
import SegmentDetails from './SegmentDetails'

import ShstLayer from '../layers/ShstLayer'

const containerStyle: React.CSSProperties = {
  display: 'flex',
  padding: 10,
  borderRadius: 5,
  border: '1px solid DimGray',
  flexDirection: 'column'
}

// https://github.com/cssinjs/jss/issues/1344#issuecomment-734402215
const divStyle: React.CSSProperties = {
  fontSize: '3em',
  fontWeight: 500,
  padding: 5
}

const colors = {
  primary: '#333',
  light: '#aaa'
}

const getTargetMapOpacityControl = (layer: ShstLayer) => (
  <div>
    <div style={{fontSize: '1.4em', fontWeight: 500, borderBottom: `1px solid ${colors.primary}`, color: colors.primary}}>
      Target Layer
            <span style={{float: 'right'}}> <input type='checkbox' onClick={layer.toggleTarget} /> </span>
    </div>
    <label style={{color: colors.light}}> Opacity </label>
    <input type="range" min="1" max="100" onChange={layer.targetOpacity} style={{width: '100%'}} />
  </div>
)

const getNumEdgesRow = (layer: ShstLayer) => (
  <div style={{display: 'flex', paddingBottom: 15}}>
    <div style={{flex: '1', textAlign: 'center', width: '100%'}}>
      <div># Edges </div>
      <div style={divStyle}> {layer.numEdges.toLocaleString()} </div>
    </div>
  </div>
)

const getShstMatchesStatsRow = (layer: ShstLayer) => (
  <div>
    <div style={{flex: '1', textAlign: 'center', width: '100%'}}>
      <div>SharedStreets Matches Stats</div>
    </div>
    <div style={{display: 'flex', paddingBottom: 15}}>
      <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnMatched} >
        <div>% Matching </div>
        <div style={divStyle}> {((layer.numMatched / layer.numEdges) * 100).toFixed(1)}</div>
      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>5m </div>
        <div style={divStyle}> {((layer.match10 / layer.numEdges) * 100).toFixed(1)}</div>
      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>50m </div>
        <div style={divStyle}> {((layer.match50 / layer.numEdges) * 100).toFixed(1)}</div>
      </div>
    </div>
    <div style={{display: 'flex', paddingBottom: 15}}>
      <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnMatched} >
        <div>Mean Δ</div>
        <div style={divStyle}> {layer.meanShstMatchLenDiff.toFixed(1)}</div>
      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>Median Δ</div>
        <div style={divStyle}> {layer.medianShstMatchLenDiff.toFixed(1)}</div>
      </div>
    </div>
  </div>
)

const getChosenForwardMatchesStatsRow = (layer: ShstLayer) => (
  <div>
    <div style={{flex: '1', textAlign: 'center', width: '100%'}}>
      <div>Chosen Forward Matches Stats</div>
    </div>
    <div style={{display: 'flex', paddingBottom: 15}}>
      <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnJoined} >
        <div>% Matching </div>
        <div style={divStyle}> {((layer.numChosenForwardMatched / layer.numEdges) * 100).toFixed(1)}</div>

      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>5m </div>
        <div style={divStyle}> {((layer.chosenForward10 / layer.numEdges) * 100).toFixed(1)}</div>
      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>50m </div>
        <div style={divStyle}> {((layer.chosenForward50 / layer.numEdges) * 100).toFixed(1)}</div>
      </div>
    </div>

    <div style={{display: 'flex', paddingBottom: 15}}>
      <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnMatched} >
        <div>Mean Δ</div>
        <div style={divStyle}> {layer.meanFChosenMatchLenDiff.toFixed(1)}</div>
      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>Median Δ</div>
        <div style={divStyle}> {layer.medianFChosenMatchLenDiff.toFixed(1)}</div>
      </div>
    </div>
  </div>
)

const getChosenBackwardMatchesStatsRow = (layer: ShstLayer) => (
  <div>
    <div style={{flex: '1', textAlign: 'center', width: '100%'}}>
      <div>Chosen Backward Matches Stats</div>
    </div>
    <div style={{display: 'flex', paddingBottom: 15}}>
      <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnJoined} >
        <div>% Matching </div>
        <div style={divStyle}> {((layer.numChosenBackwardMatched / layer.numUnidirectional) * 100).toFixed(1)}</div>

      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>5m </div>
        <div style={divStyle}> {((layer.chosenBackward10 / layer.numEdges) * 100).toFixed(1)}</div>
      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>50m </div>
        <div style={divStyle}> {((layer.chosenBackward50 / layer.numEdges) * 100).toFixed(1)}</div>
      </div>
    </div>

    <div style={{display: 'flex', paddingBottom: 15}}>
      <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnMatched} >
        <div>Mean Δ</div>
        <div style={divStyle}> {layer.meanBChosenMatchLenDiff.toFixed(1)}</div>
      </div>
      <div style={{flex: '1', textAlign: 'center'}}>
        <div>Median Δ</div>
        <div style={divStyle}> {layer.medianBChosenMatchLenDiff.toFixed(1)}</div>
      </div>
    </div>
  </div>
)

const getStatsTable = (layer: ShstLayer) => (
  <div style={containerStyle}>
    {
      layer.numMatched ?
        (
          <React.Fragment>
            {getNumEdgesRow(layer)}

            {getShstMatchesStatsRow(layer)}

            {getChosenForwardMatchesStatsRow(layer)}

            {getChosenBackwardMatchesStatsRow(layer)}
          </React.Fragment>)
        : <div style={{flex: '1', textAlign: 'center'}}> <h4>Loading Conflation </h4></div >
    }
  </div>
)

export default ({layer}: {layer: ShstLayer}) => (
  <div style={{backgroundColor: '#fff', padding: 15}}>
    <div>
      {getTargetMapOpacityControl(layer)}
      {getStatsTable(layer)}
      <SegmentDetails layer={layer} />
    </div>
  </div>
)
