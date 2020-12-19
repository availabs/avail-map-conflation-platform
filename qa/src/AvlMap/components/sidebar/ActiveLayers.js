import React, {Component} from 'react';
// import { connect } from 'react-redux';
import LayerControl from '../layerControl/layerControl'

 class ActiveLayers extends Component {

  onDragOver(e) {
    e.preventDefault()
  }
  onDrop(e) {
    this.props.dropLayer();
  }
 
  render() {
    const { layers, activeLayers } = this.props
    let ActiveLayersStyle = {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: 5,
    }
    const layersMap = {};
    layers.forEach(layer => {
      layersMap[layer.name] = layer;
    })

    const toRender = activeLayers.map((d, i) =>
      <LayerControl key={ d }
        index={ i }
        layer={ layersMap[d] }
        showRemoveLayer={ (layersMap[d].removeableIfSingle === false) && (activeLayers.length === 1) ? false : (layersMap[d].removeable === false) ? false : true }
        { ...this.props }/>
    )

    return (
      <div className='active-layer-container' style={ActiveLayersStyle}
        onDragOver={ e => this.onDragOver(e) }
        onDrop={ e=> this.onDrop(e) }>
        { toRender.reverse() }
      </div>
    );
  }
}

export default ActiveLayers