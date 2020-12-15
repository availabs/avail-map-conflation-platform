import React from "react"

import mapboxgl from 'mapbox-gl/dist/mapbox-gl'
import { MAPBOX_TOKEN } from 'config'

import deepequal from "deep-equal"
import get from "lodash.get"
import styled from "styled-components"
import { format as d3format } from "d3-format"

import Sidebar from './components/sidebar'
import Infobox from './components/infobox/Infobox'
import MapPopover from "./components/popover/MapPopover"
import MapModal from "./components/modal/MapModal"
import MapActions from "./components/MapActions"
import MapMessages from "./components/MapMessages"

import { ScalableLoading } from "./components/loading/LoadingPage"

import './avlmap.css'

import {
	dispatchMessage,
	FilterMessage
} from "./LayerMessageSystem"



let UNIQUE_ID = 0;
const getUniqueId = (str = "unique-id") =>
	`${ str }-${ ++UNIQUE_ID }`

// const getMapPreview = (map, style, size=[60, 40]) => {
//   if (!Boolean(map)) return "";
//
//   return `https://api.mapbox.com/styles/v1/am3081/${ style }/static/` +
//     `${ map.getCenter().toArray().join(',') },${ map.getZoom() },0,0/` +
//     `${ size.join('x') }?` +
//     `attribution=false&logo=false&access_token=${ mapboxgl.accessToken }`;
// }
const getStaticImageUrl = (style, size = [60, 40]) =>
  `https://api.mapbox.com/styles/v1/am3081/${ style }/static/` +
    `${ -74.2179 },${ 43.2994 },1.5/${ size.join("x") }?` +
    `attribution=false&logo=false&access_token=${ mapboxgl.accessToken }`

export const DEFAULT_STYLES = [
  { name: "Dark",
    style: "mapbox://styles/am3081/cjqqukuqs29222sqwaabcjy29" },
  { name: "Light",
    style: 'mapbox://styles/am3081/cjms1pdzt10gt2skn0c6n75te' },
  { name: "Satellite",
    style: 'mapbox://styles/am3081/cjya6wla3011q1ct52qjcatxg' },
  { name: "Satellite Streets",
    style: `mapbox://styles/am3081/cjya70364016g1cpmbetipc8u` }
]

class AvlMap extends React.Component {

	static defaultProps = {
		id: null,
		height: "100%",
	  styles: [...DEFAULT_STYLES],
	  styleName: "Dark",
		style: null,
		center: [-73.680647, 42.68],
		minZoom: 2,
		zoom: 10,
		layers: [],
	  mapControl: 'bottom-right',
	  scrollZoom: true,
    boxZoom: true,
	  sidebar: true,
    mapactions: true,
		showStyleControl: false,
	  update: [],
		header: "AVAIL Map",
	  sidebarPages: ["layers", "basemaps"],
		layerProps: {},
		preserveDrawingBuffer: false,
    MAPBOX_TOKEN: MAPBOX_TOKEN
	}

  static ActiveMaps = {};
  static addActiveMap = (id, component, map) => {
    AvlMap.ActiveMaps[id] = { component, map };
  }
  static removeActiveMap = id => {
    delete AvlMap.ActiveMaps[id];
  }
  static updateMap = ([id, action, ...args]) => {
    if (id in AvlMap.ActiveMaps) {
      const { component } = AvlMap.ActiveMaps[id];
      component && component[action] && component[action].call(component, ...args);
    }
  }
  static doAction = ([id, action, ...args]) => {
      console.log('in do action')
    if (id in AvlMap.ActiveMaps) {
      const { component } = AvlMap.ActiveMaps[id];
      if(component && component[action]) {
          console.log('do action', id, action, ...args)
          let result = component[action].call(component, ...args);
          console.log('action result ', result)
          return result
      }
    }
  }
	sta
  testFunc(...args) {
    console.log("TEST FUNCTION:", ...[...args].map(arg => arg.toString()));
  }

  constructor(props) {
    super(props);
  	this.state = {
			id: this.props.id || getUniqueId('avl-map'),
  		map: null,
			dynamicLayers: [],
  		activeLayers: [],
      sources: {},
  		popover: {
  			pos: [0, 0],
  			pinned: false,
  			data: [],
				layer: null
  		},
      dragPan: true,
  		dragging: null,
  		dragover: null,
      width: 0,
      height: 0,
      messages: [],
      isOpen: true,
      transitioning: false,
      style: props.styles.reduce((a, c) =>
				((c.name === props.styleName) || (c.name === props.style)) ? c : a
			, props.styles[0])
  	}
    this.MOUNTED = false;
    mapboxgl.accessToken = props.MAPBOX_TOKEN
    this.container = React.createRef();
  }

  setState(...args) {
    this.MOUNTED && super.setState(...args);
  }
  forceUpdate(...args) {
    this.MOUNTED && super.forceUpdate(...args);
  }

  componentDidMount() {
    this.MOUNTED = true;

    const {
    	center,
    	minZoom,
    	zoom,
      mapControl,
			preserveDrawingBuffer,
			style
    } = this.props;

		const { id } = this.state;

		const regex = /^mapbox:\/\/styles\//;

    const map = new mapboxgl.Map({
      container: id,
      style: regex.test(style) ? style : this.state.style.style,
      center,
      minZoom,
      zoom,
      attributionControl: false,
			preserveDrawingBuffer
    });


    if(mapControl) {
      map.addControl(new mapboxgl.NavigationControl(), mapControl);
    }

    if(!this.props.boxZoom){
      map.boxZoom.disable();
    }

    if(!this.props.scrollZoom) {
      console.log('scroll zoom disable')
      map.scrollZoom.disable();
    };

    if(!this.props.dragPan) {
      console.log('dragPan disable')
      map.dragPan.disable();
    }

    ([...document.getElementsByClassName("mapboxgl-ctrl-logo")])
      .forEach(logo => {
        logo.parentElement.style.margin = '0';
        logo.style.display = 'none';
      })

    this.props.layers.forEach(layer => {
      layer.version = layer.version || 1.0;
      layer.initComponent(this);
    });

    map.on('load',  () => {
      const activeLayers = [];

      this.props.layers.forEach(layer => {

        layer.initMap(map);

      	if (layer.active) {
          this._addLayer(map, layer, activeLayers);
          activeLayers.push(layer.name);

          layer._onAdd(map);
          ++layer.loading;

					const layerProps = get(this.props.layerProps, layer.name, {});
					Promise.resolve(layer.onAdd(map, layerProps))
            .then(() => --layer.loading)
            .then(() => layer.render(map))
            .then(() => this.setState({ activeLayers }));
      	}
      })

      if (this.props.fitBounds){
        map.fitBounds(this.props.fitBounds)
      }
      this.setState({ map, activeLayers: [] })

      AvlMap.addActiveMap(id, this, map);
    })
    // map.on('sourcedata', () => this.foceUpdate());
    this.setContainerSize();
  }
  componentWillUnmount() {
    // this.state.activeLayers.forEach(layer => this.removeLayer(layer));

    this.MOUNTED = false;

    AvlMap.removeActiveMap(this.state.id);
  }

  componentDidUpdate(oldProps, oldState) {
    this.setContainerSize();

		this.state.activeLayers.forEach(layerName => {
			const layer = this.getLayer(layerName);

			const layerProps = get(this.props, ["layerProps", layerName], null);
			if (layerProps) {
				layer.receiveProps(oldProps.layerProps[layerName], layerProps);
			}

			if (!deepequal(oldProps.layerProps[layerName], layerProps)) {
				layer.onPropsChange(oldProps.layerProps[layerName], layerProps);
			}
		})
  }

	addDynamicLayer(layerName, layerFactory) {
  	return new Promise((resolve, reject) => {
      if (!this.state.map) return resolve();

      const layer = this.getLayer(layerName);

      if (!layer) return resolve();

      const newLayer = layerFactory.call(null, layer),
          newLayerName = newLayer.name,
          allLayers = [
              ...this.props.layers,
              ...this.state.dynamicLayers
          ];

      newLayer._isDynamic = true;
      newLayer.initComponent(this);
      newLayer.initMap(this.state.map);

      const adjustName = allLayers.reduce((a, c) =>
          a || c.name === newLayerName
          , false)

      if (adjustName) {
          const regExpStr = newLayerName + " \\((\\d+)\\)",
              regex = new RegExp(regExpStr),
              num = allLayers.reduce((a, c) => {
                  const match = regex.exec(c.name);
                  if (match) {
                      return Math.max(a, +match[1]);
                  }
                  return a;
              }, 1);
          newLayer.name = `${newLayerName} (${num + 1})`;
      }
      if (newLayer.active) {
          this._addLayer(this.state.map, newLayer);
          ++newLayer.loading;
          newLayer._onAdd(this.state.map);

          const layerProps = get(this.props.layerProps, newLayer.name, {});
          Promise.resolve(newLayer.onAdd(this.state.map, layerProps))
              .then(() => --newLayer.loading)
              .then(() => newLayer.render(this.state.map))
              .then(() => this.setState({activeLayers: [...this.state.activeLayers, newLayer.name]}));
      }
      this.setState({
          dynamicLayers: [
              ...this.state.dynamicLayers,
              newLayer
          ]
      })
      resolve(newLayer)
    })
	}
	deleteDynamicLayer(layerName, otherLayerName=false) {
		layerName = otherLayerName || layerName;

		const layer = this.getLayer(layerName);

		if (!layer) return;

		this.removeLayer(layerName);

		this.setState({
			dynamicLayers: this.state.dynamicLayers.filter(l => l.name !== layerName)
		})
	}

  sendMessage(layerName, data) {
    data = {
      id: getUniqueId(),
      duration: data.onConfirm ? 0 : 6000,
      ...data,
			Message: data.msg || data.message || data.Message,
      update: false,
      layer: this.getLayer(layerName)
    }
// console.log("<AvlMap.sendMessage>", layerName, data, [...this.state.messages]);
    const update = this.state.messages.reduce((a, c) => a || (c.id === data.id), false);
    let messages = [...this.state.messages];
    if (update) {
      messages = messages.map(({ id, Message, ...rest }) => ({
        Message: id === data.id ? data.Message : Message,
        id,
        ...rest,
        update: id === data.id ? Date.now() : false
      }))
    }
    else {
      messages = [...messages, data];
    }
    this.setState({ messages });
  }
  dismissMessage(id) {
    const messages = this.state.messages.filter(m => m.id !== id);
// console.log("<AvlMap.dismissMessage>", id, messages);
    this.setState({ messages });
  }

	renderLayer(layerName) {
		const layer = this.getLayer(layerName);
		layer && layer.active && layer.render(this.state.map);
	}

  setContainerSize() {
    const div = this.container.current,
      width = div.scrollWidth,
      height = div.scrollHeight;
    if ((width !== this.state.width) || (height !== this.state.height)) {
      this.setState({ width, height })
    }
  }

  getLayer(layerName) {
  	return [
			...this.props.layers,
			...this.state.dynamicLayers
		]
		.reduce((a, c) => c.name === layerName ? c : a, null);
  }

  _addLayer(map, newLayer, activeLayers=this.state.activeLayers) {
    const sources = { ...this.state.sources };

    const sourcesToAdd = new Set(newLayer.layers.map(l => l.source))

    newLayer.sources.forEach(source => {
      if (!sourcesToAdd.has(source.id)) return;

      if (!map.getSource(source.id)) {
        map.addSource(source.id, source.source);
      }
      if (!(source.id in sources)) {
        sources[source.id] = [];
      }
    })

    const activeMBLayers = activeLayers.reduce((a, ln) => {
      const layer = this.props.layers.reduce((a, c) => c.name === ln ? c : a);
      return [...a, ...layer.layers];
    }, [])

    const newMBLayers = newLayer.layers.slice();
    newMBLayers.sort((a, b) => {
      const azi = a.zIndex || 0,
        bzi = b.zIndex || 0;
      return azi - bzi;
    })

    //console.log('mbLayers', newMBLayers)

    newMBLayers.forEach(mbLayer => {
      const zIndex = mbLayer.zIndex || 0;
      let layerAdded = false;
      activeMBLayers.forEach(aMBL => {
        const aMBLzIndex = aMBL.zIndex || 0;
        if (aMBLzIndex > zIndex) {
          if(!map.getLayer(mbLayer.id)) {
            map.addLayer(mbLayer, aMBL.id);
            layerAdded = true;
          }
        }
      })
      if (!layerAdded) {
        if (Boolean(mbLayer.beneath) && Boolean(map.getLayer(mbLayer.beneath))) {
          map.addLayer(mbLayer, mbLayer.beneath);
        }
        else {
          map.addLayer(mbLayer);
        }
      }
      console.log('err', mbLayer, mbLayer.source)
      if(!sources[mbLayer.source]) {
        sources[mbLayer.source] = []
      }
      sources[mbLayer.source].push(mbLayer.id)
    })

    this.setState({ sources });
  }

  addLayer(layerName, otherLayerName=false) {
		layerName = otherLayerName || layerName;

  	const layer = this.getLayer(layerName);
  	if (this.state.map && layer && !layer.active) {
  		layer.active = true;
      this._addLayer(this.state.map, layer);
      ++layer.loading;
      layer._onAdd(this.state.map);


			const layerProps = get(this.props.layerProps, layerName, {});
      Promise.resolve(layer.onAdd(this.state.map, layerProps))
        .then(() => --layer.loading)
        .then(() => layer.render(this.state.map))
        .then(() => this.setState({ activeLayers: [...this.state.activeLayers, layerName] }));
      ;
  	}
  }
  removeLayer(layerName, otherLayerName=false) {
		layerName = otherLayerName || layerName;

  	const layer = this.getLayer(layerName);
  	if (this.state.map && layer && layer.active && !layer.loading) {
  		layer.active = false;
  		layer._onRemove(this.state.map);
  		layer.onRemove(this.state.map);

      const sourcesToRemove = []
  		layer.layers.forEach(layer => {
  			this.state.map.removeLayer(layer.id);
        sourcesToRemove.push([layer.source, layer.id])
  		});

      const sources = { ...this.state.sources };
      sourcesToRemove.forEach(([sourceId, layerId]) => {
        if (sourceId in sources) {
          sources[sourceId] = sources[sourceId].filter(lId => lId !== layerId);
        }
      })

  		layer.sources.forEach(source => {
        if (get(sources, [source.id, "length"], "not-added") === 0) {
          this.state.map.removeSource(source.id);
          delete sources[source.id]
        }
  		})

  		this.setState({ activeLayers: this.state.activeLayers.filter(ln => ln !== layerName), sources });
  	}
    else if (this.state.map && layer && layer.active && layer.loading) {
      this.sendMessage(null, { Message: "Cannot remove a layer while it is loading." })
    }
  }
  toggleLayerVisibility(layerName) {
  	const layer = this.getLayer(layerName);
  	if (this.state.map && layer) {
  		layer.toggleVisibility(this.state.map);
			this.forceUpdate();
  	}
  }

  updatePopover(layerName, update) {
		if ((update.pinned === false) && this.state.popover.pinned) {
			const func = this.state.popover.layer.popover.onUnPinned;
			(typeof func === "function") && func.call(this.state.popover.layer);
			this.state.popover.layer._clearPinnedState();
		}
  	this.setState({ popover: { ...this.state.popover, ...update }});
  }

  toggleModal(layerName, modalName, props={}) {
  	const layer = this.getLayer(layerName),
      modal = layer.modals[modalName],
      show = !modal.show;

		this.props.layers.forEach(layer => {
			if (layer.modals) {
        for (const modal in layer.modals) {
				  layer.modals[modal].show = false;
        }
			}
		})
    modal.show = show;
    modal.props = modal.props ? { ...modal.props, ...props } : props;
    if (!show && (typeof modal.onClose === "function")) {
      modal.onClose.call(layer);
    }
  	this.forceUpdate();
  }
  updateModal(layerName, modalName, props={}) {
    const layer = this.getLayer(layerName),
      modal = layer.modals[modalName];
    modal.props = modal.props ? { ...modal.props, ...props } : props;
    this.forceUpdate();
  }

  onSelect(layerName, selection) {
    if (!this.state.map) return;

  	const layer = this.getLayer(layerName)

    layer.selection = selection;
    ++layer.loading;
    this.forceUpdate();

    layer.onSelect(selection)
      // .then(() => layer.fetchData())
      .then(data => layer.active && (layer.receiveDataOld(this.state.map, data), layer.render(this.state.map)))
      .then(() => --layer.loading)
      .then(() => this.forceUpdate());
  }

  toggleInfoBox(layerName, infoBoxName) {
  	const layer = this.getLayer(layerName)

  	if (layer.infoBoxes) {
  		const infoBox = layer.infoBoxes[infoBoxName];
  		if (infoBox) {
  			infoBox.show = !infoBox.show;
  		}
  	}
  	this.forceUpdate();
  }

  updateFilter(layerName, filterName, value = null) {
    if (!this.state.map) return;

  	const layer = this.getLayer(layerName),
      filter = layer.filters[filterName],
  		oldValue = filter.value,
      domain = filter.domain;

	  (value !== null) && (filter.value = value);

		let onChange = () => {};
  	if (layer.filters[filterName].onChange) {
      if (layer.version >= 2) {
				onChange = () => layer.filters[filterName].onChange.call(layer, oldValue, value, domain);
      }
      else {
        onChange = () => layer.filters[filterName].onChange(this.state.map, layer, value, oldValue);
      }
  	}

  	++layer.loading;
  	this.forceUpdate();

		// Promise.resolve(onChange())
		// 	.then(() => layer.onFilterFetch(filterName, oldValue, value))
		layer.onFilterFetch(filterName, oldValue, value)
      .then(data => {
				if (layer.active) {
					onChange();
					layer.receiveDataOld(this.state.map, data);
					(data !== false) && layer.render(this.state.map);
				}
			})
      .then(() => --layer.loading)
			.then(() => {
					if (filter.dispatchMessage) {
						const data = filter.dispatchFunc ? filter.dispatchFunc.call(layer) : null;
						dispatchMessage(layerName, new FilterMessage(layerName, filterName, oldValue, value, data));
					}
			})
      .then(() => this.forceUpdate());

    // if (layer.filters[filterName].refLayers) {
    //   layer.filters[filterName].refLayers.forEach(refLayerName => {
		//
    //   	const layer = this.getLayer(refLayerName),
    //       filter = layer.filters[filterName],
    //   		oldValue = filter.value,
    //       domain = filter.domain;
		//
    //     (value !== null) && (filter.value = value);
		//
    //     if (layer.active) {
		//
    //       if (layer.filters[filterName].onChange) {
    //         if (layer.version >= 2) {
    //           layer.filters[filterName].onChange.call(layer, oldValue, value, domain);
    //         }
    //         else {
    //           layer.filters[filterName].onChange(this.state.map, layer, value, oldValue);
    //         }
    //       }
		//
    //       ++layer.loading;
    //       this.forceUpdate();
		//
    //       layer.onFilterFetch(filterName, oldValue, value)
    //         .then(data => layer.active && (layer.receiveDataOld(this.state.map, data), layer.render(this.state.map)))
    //         .then(() => --layer.loading)
    //         .then(() => this.forceUpdate());
    //     }
    //   })
    // }
  }

  updateLegend(layerName, update) {
    if (!this.state.map) return;

  	const layer = this.getLayer(layerName);

		layer.legend = {
			...layer.legend,
			...update
		};
		++layer.loading;
		this.forceUpdate();

  	layer.onLegendChange()
			.then(data => layer.active && (layer.receiveDataOld(this.state.map, data), layer.render(this.state.map)))
			.then(() => --layer.loading)
			.then(() => this.forceUpdate());
  }

  fetchLayerData(layerName) {
    if (!this.state.map) return;

  	const layer = this.getLayer(layerName);

  	++layer.loading;
  	this.forceUpdate();

  	layer.fetchData()
			.then(data => layer.active && (layer.receiveDataOld(this.state.map, data), layer.render(this.state.map)))
			.then(() => --layer.loading)
			.then(() => this.forceUpdate());
  }

  updateDrag(update) {
  	this.setState({
  		...this.state,
  		...update
  	})
  }
  dropLayer() {
		const activeLayers = this.state.activeLayers.filter(l => l !== this.state.dragging),
			insertBefore = activeLayers[this.state.dragover];
		activeLayers.splice(this.state.dragover, 0, this.state.dragging)
		const draggingLayer = this.getLayer(this.state.dragging),
			beforeLayer = this.getLayer(insertBefore);
		let beforeLayerId = null;
		if (beforeLayer) {
			beforeLayerId = beforeLayer.layers[0].id;
		}
		draggingLayer.layers.forEach(({ id }) => {
			this.state.map.moveLayer(id, beforeLayerId)
		})
		this.setState({ activeLayers });

    const layersWithZIndex = activeLayers.reduce((a, c) => {
      const layer = this.getLayer(c),
        mbLayers = layer.layers.reduce((a, c) => {
          return c.zIndex ? [...a, c] : a;
        }, []);
      return [...a, ...mbLayers];
    }, [])
    layersWithZIndex.sort((a, b) => a.zIndex - b.zIndex);
    layersWithZIndex.forEach(mbLayer => {
      this.state.map.moveLayer(mbLayer.id);
    })
  }

  onTransitionStart() {
    this.setState({ transitioning: true });
  }
  onOpenOrClose(isOpen) {
    this.setState({ isOpen, transitioning: false });
  }

  setMapStyle(style) {
    const { map } = this.state;
    if (Boolean(map) && (style.style !== this.state.style.style)) {
      map.once('style.load', e => {
        const activeLayers = [];
        this.state.activeLayers.forEach(layerName => {
        	const layer = this.getLayer(layerName);
          this._addLayer(map, layer, activeLayers);
          activeLayers.push(layerName);
          layer.onStyleChange(map);
        });
      })
      this.state.activeLayers.forEach(layerName => {
        const layer = this.getLayer(layerName);
        layer._onRemove(map);
      })
      map.setStyle(style.style);
    }
    this.setState({ style });
  }

	render() {
		const actionMap = {
			toggleModal: this.toggleModal.bind(this),
      updateModal: this.updateModal.bind(this),
			toggleInfoBox: this.toggleInfoBox.bind(this),
			setMapStyle: this.setMapStyle.bind(this)
		}
		const allLayers = [
			...this.props.layers,
			...this.state.dynamicLayers
		]
		const mapStyles = this.props.styles.map(s => ({
			...s,
			url: getStaticImageUrl(s.style.slice(23))
		}))
		return (
			<div id={ this.state.id } style={ { height: this.props.height } } ref={ this.container } className='z-30 focus:outline-none active:outline-none'>

				{ !this.props.sidebar ? null :
          <Sidebar isOpen={ this.state.isOpen }
            transitioning={ this.state.transitioning }
            onOpenOrClose={ this.onOpenOrClose.bind(this) }
            onTransitionStart={ this.onTransitionStart.bind(this) }
            layers={ allLayers }
  					activeLayers={ this.state.activeLayers }
  					addLayer={ this.addLayer.bind(this) }
  					removeLayer={ this.removeLayer.bind(this) }
						deleteDynamicLayer={ this.deleteDynamicLayer.bind(this) }
  					toggleLayerVisibility={ this.toggleLayerVisibility.bind(this) }
  					actionMap= { actionMap }
  					header={ this.props.header }
  					toggleModal={ this.toggleModal.bind(this) }
            updateModal={ this.updateModal.bind(this) }
  					updateFilter={ this.updateFilter.bind(this) }
  					updateLegend={ this.updateLegend.bind(this) }
  					fetchLayerData={ this.fetchLayerData.bind(this) }
  					updateDrag={ this.updateDrag.bind(this) }
  					dropLayer={ this.dropLayer.bind(this) }
            pages={ this.props.sidebarPages }
            mapStyles={ mapStyles }
            style={ this.state.style }
            setMapStyle={ this.setMapStyle.bind(this) }
            map={ this.state.map }/>
        }

				<Infobox layers={ allLayers }
					activeLayers={ this.state.activeLayers }/>

				<MapPopover { ...this.state.popover }
					updatePopover={ this.updatePopover.bind(this) }
          mapSize={ {
            width: this.state.width,
            height: this.state.height
          } }/>

				<MapModal layers={ allLayers }
					activeLayers={ this.state.activeLayers }
					toggleModal={ this.toggleModal.bind(this) }/>

        <MapActions layers={ allLayers }
					activeLayers={ this.state.activeLayers }
          sidebar={ this.props.sidebar }
          isOpen={ (this.state.isOpen && !this.state.transitioning) || (!this.state.isOpen && this.state.transitioning) }
          actionMap={ actionMap }
          mapStyles={ mapStyles }
					style={ this.state.style }
					showStyleControl={ this.props.showStyleControl }
					getStaticImageUrl={ getStaticImageUrl }
					showMapActions={ this.props.mapactions }/>

        <MapMessages
          messages={ this.state.messages }
          dismiss={ this.dismissMessage.bind(this) }/>

        <LoadingLayers layers={ allLayers }
          sidebar={ this.props.sidebar }
          isOpen={ (this.state.isOpen && !this.state.transitioning) || (!this.state.isOpen && this.state.transitioning) }/>
			</div>
		)
	}
}

const LoadingContainer = styled.div`
	position: absolute;
	bottom: 20px;
	left: ${ props => props.sidebar && props.isOpen ? 340 : props.sidebar && !props.isOpen ? 40 : 20 }px;
	transition: left 0.25s;
	z-index: 50;
	display: flex;
	flex-direction: column;
  pointer-events: none;
  color: ${ props => props.theme.textColorHl };
  outline: 0;


  > * {
    margin-bottom: 10px;
    min-width: 300px;
    background-color: ${ props => props.theme.sidePanelBg };
    border-radius: 4px;
    border-top-right-radius: ${ props => (props.height + props.padding * 2) * 0.5 }px;
    border-bottom-right-radius: ${ props => (props.height + props.padding * 2) * 0.5 }px;
    font-size: 1rem;
  }
	> *:last-child {
		margin-bottom: 0px;
	}
`
class LoadingIndicator extends React.Component {
	state = {
		progress: null
	}
	format = d3format(".0%");

	componentDidMount() {
		this.props.layer.registerLoadingIndicator(this.setState.bind(this));
	}
	componentWillUnmount() {
		this.props.layer.unregisterLoadingIndicator();
	}
	render() {
		const { layer } = this.props,
			height = 40,
			padding = 10;
		return (
			<div key={ layer.name } style={ { height: `${ height + 20 }px`, padding: `${ padding }px`, display: "flex" } }>

				<div style={ { height: `${ height }px`, lineHeight: `${ height }px`, textAlign: "left", width: `65%` } }>
					 { layer.name }
				</div>

				<div style={ { paddingLeft: `${ padding }px`, height: `${ height }px`, lineHeight: `${ height }px`, textAlign: "left", width: `calc(35% - ${ height }px)` } }>

					{ this.state.progress === null ? null :
						`${ this.format(this.state.progress) }`
					}

				</div>

				<ScalableLoading scale={ height * 0.01 }/>
			</div>
		)
	}
}
class LoadingLayers extends React.Component {
	render() {
	  const { layers, sidebar, isOpen } = this.props,
			loadingLayers = layers.reduce((a, c) => {
		    c.loading && a.push(c);
				// a.push(c);
		    return a;
		  }, []),
			height = 40,
			padding = 10;
		return (
	    <LoadingContainer sidebar={ sidebar } isOpen={ isOpen } height={ height } padding={ padding }>
	      { loadingLayers.map((l, i) => <LoadingIndicator key={ l.name } layer={ l }/>) }
	    </LoadingContainer>
		)
	}
}

export default AvlMap
