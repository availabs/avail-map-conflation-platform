import React from "react"

import AttributesTable from "./components/AttributesTable"

import get from "lodash.get"

const DEFAULT_OPTIONS = {
	sources: [],
	layers: [],

	active: false,
	loading: 0,

	popover: false,
	actions: false,
  modals: false,
	infoBoxes: false,
	legend: false,
	filters: false,
	select: false,
  onClick: false,
	onZoom: false,

	_isVisible: true,

  onHover: false,

	showAttributesModal: true,

  mapActions: {},

  selection: []
}

class MapLayer {
	constructor(name, _options = {}) {
		const options = { ...DEFAULT_OPTIONS, ..._options };

		this.component = null;
		this.map = null;

		this.showPopover = false;
		this.latestPopoverId = 0;

		this.name = name;

    for (const key in options) {
      this[key] = options[key];
    }
		this.LoadingIndicator = () => {};

    this.boundFunctions = {};
    this.hoverSourceData = {};
		this.hoveredFeatureIds = new Set();
		this.pinnedFeatureIds = new Set();

		this._mousemove = this._mousemove.bind(this);
		this._mouseleave = this._mouseleave.bind(this);
		this._popoverClick = this._popoverClick.bind(this);

    this._mousedown = this._mousedown.bind(this);

    this._mapClick = this._mapClick.bind(this);

    this.onHoverMove = this.onHoverMove.bind(this);
    this.onHoverLeave = this.onHoverLeave.bind(this);
	}

	registerLoadingIndicator(func) {
		this.LoadingIndicator = func;
	}
	unregisterLoadingIndicator() {
		this.LoadingIndicator = () => {};
	}

  initComponent(component) {
    this.component = component;
    // this.updatePopover = component.updatePopover.bind(component);
		if (this.showAttributesModal !== false) {
			const modals = this.modals || {};
			this.modals = {
				...modals,
				"avl-attributes": {
					title: "Attributes",
					comp: ({ layer }) => <AttributesTable layer={ layer }/>,
					show: false,
					position: "bottom",
					startSize: [800, 500]
				}
			};

			if (!get(this, 'component.props.sidebar', false) ||
					!get(this, 'component.props.sidebarPages', []).includes("layers")) {
				this.mapActions =
					get(this, 'component.props.hideAttributes', false) ?
					{...this.mapActions} :
						{
					...this.mapActions,
					"avl-attributes": {
						Icon: ({layer}) => <span className={`fa fa-lg fa-eye`}/>,
						tooltip: "Toggle Attributes",
						action: function () {
							this.doAction(["toggleModal", "avl-attributes"]);
						}
					}
				}
			}
			else {
				const actions = this.actions || [];
				this.actions =
					get(this, 'component.props.hideAttributes', false) ?
						[
							...actions.filter(({ tooltip }) => tooltip !== "Toggle Attributes"),
						] :
						[
							...actions.filter(({ tooltip }) => tooltip !== "Toggle Attributes"),
							{
								Icon: () => <span className={ `fa fa-lg fa-eye` }/>,
								action: ["toggleModal", "avl-attributes"],
								tooltip: "Toggle Attributes"
							}
						]
			}
		}
  }
	initMap(map) {
    this.map = map;
	}

	onAdd(map, props) {

	}
	_onAdd(map) {
		if (this.popover) {
			this.addPopover(map);
		}
		if (this.select) {
			this.addBoxSelect(map);
		}
    if (this.onClick) {
      this.addOnClick(map);
    }
    if (this.onHover) {
      this.addOnHover(map);
    }
		if (this.onZoom) {
			this.addOnZoom(map);
		}
		this.layers.forEach(layer => {
			const layerVisibility = map.getLayoutProperty(layer.id, 'visibility'),
				isVisible = (layerVisibility !== "none") && this._isVisible;
			map.setLayoutProperty(layer.id, 'visibility', isVisible ? "visible" : "none");
		})
	}
	onRemove(map) {

	}
	_onRemove(map) {
		if (this.onZoom) {
			this.removeOnZoom(map);
		}
    if (this.onHover) {
      this.removeOnHover(map);
    }
    if (this.onClick) {
      this.removeOnClick(map);
    }
    if (this.select) {
      this.removeBoxSelect(map);
    }
		if (this.popover) {
			this.removePopover(map);
		}
	}

	receiveProps(oldProps, newProps) {
		for (const key in newProps) {
			this[key] = newProps[key];
		}
	}
	onPropsChange(oldProps, newProps) {
    this.doAction(["fetchLayerData"]);
	}

	getLayerData(layers = []) {
		if (!this.map) return { keys: [], data: [] };

		let data = [],
			keys = { layer: true };

		layers = layers.length ? layers : this.layers.map(({ id }) => id);

		const sourceData = [];

		this.layers.forEach(l => {
			if (layers.includes(l.id)) {
				sourceData.push([l["source"], l["source-layer"], l["id"]])
			}
		})
		sourceData.forEach(([sourceId, sourceLayer, layer]) => {
			this.map.querySourceFeatures(sourceId, { sourceLayer })
				.forEach(feature => {
					const _keys = Object.keys(feature.properties);
					_keys.forEach(key => keys[key] = true);
					const row = { layer };
					_keys.forEach(key => {
						row[key] = feature.properties[key];
					})
					data.push(row);
				})
		})

		keys = data.reduce((keys, row) => ({
			...keys,
			...Object.keys(row).reduce((a, c) => ({ ...a, [c]: true }), {})
		}), keys)

		keys = Object.keys(keys);

		return { data, keys };
	}

	addOnZoom(map) {
		const func = () => {
			const zoom = map.getZoom();
			this.onZoom(zoom);
		}
		this.boundFunctions["on-zoom"] = func;
		map.on("zoom", func);
	}
	removeOnZoom(map) {
		map.off("zoom", this.boundFunctions["on-zoom"]);
	}

  addOnHover(map) {
    this.onHover.layers.forEach(layer => {
      const data = this.layers.reduce((a, c) => c.id === layer ? c : a, false);
      this.hoverSourceData[layer] = {
        source: data.source,
        sourceLayer: data['source-layer']
      };

      let func = e => this.onHoverMove(e, layer, map);
      this.boundFunctions[`on-hover-move-${ layer }`] = func;
      map.on("mousemove", layer, func);

      func = e => this.onHoverLeave(e, layer, map);
      this.boundFunctions[`on-hover-leave-${ layer }`] = func;
      map.on("mouseleave", layer, func);
    })
  }
  removeOnHover(map) {
    this.onHover.layers.forEach(layer => {
      let key = `on-hover-move-${ layer }`,
        func = this.boundFunctions[key];

      map.off("mousemove", layer, func);
      delete this.boundFunctions[key];

      key = `on-hover-leave-${ layer }`;
      func = this.boundFunctions[key];

      map.off("mouseleave", layer, func);
      delete this.boundFunctions[key];
    })
  }
  onHoverMove(e, layer, map) {
    const { dataFunc, minZoom, filterFunc } = this.onHover;

		const zoom = map.getZoom();
		if (minZoom && (minZoom > zoom)) {
      return this.onHoverLeave(e, layer, map);
		}

    (typeof dataFunc === "function") &&
      dataFunc.call(this, e.features, e.point, e.lngLat, layer);

    const data = this.hoverSourceData[layer];
		if (!data || !e.features.length) return;

    this.onHoverLeave(e, layer, map);

		const hover = id => {
			(id !== undefined) && (map.getCanvas().style.cursor = 'pointer');
			(id !== undefined) && this.hoveredFeatureIds.add(`${ layer }.${ id }`);
			(id !== undefined) && map.setFeatureState({ id, ...data }, { hover: true });
		}
		const hoverFeature = () => {
			const { id } = e.features[0];
			hover(id);
		}

		if (typeof filterFunc === "function") {
			const filter = filterFunc.call(this, e.features, e.point, e.lngLat, layer),
				{ source, sourceLayer } = data;
			if (filter) {
				map.querySourceFeatures(source, { sourceLayer, filter })
					.forEach(({ id }) => {
						hover(id);
					})
			}
			else {
				hoverFeature();
			}
		}
		else {
			hoverFeature();
		}
  }
  onHoverLeave(e, layer, map) {
		this.hoveredFeatureIds.forEach(key => {
			const [layer, id] = key.split("."),
				data = this.hoverSourceData[layer];
			if (data) {
				map.setFeatureState({ id, ...data }, { hover: false });
			}
		});
		map.getCanvas().style.cursor = '';
		this.hoveredFeatureIds.clear();
  }

  doAction([action, ...args]) {
    if (this.component && this.component[action]) {
      return this.component[action](this.name, ...args);
    }
  }
  forceUpdate() {
    this.component && this.component.forceUpdate();
  }

	toggleVisibility() {

		//console.log('in map layer toggle visibility',map,this.layers)
		this._isVisible = !this._isVisible;
		this.layers.forEach(layer => {
			this.map.setLayoutProperty(layer.id, 'visibility', this._isVisible ? "visible" : "none");
		})
	}

	fetchData() {
		return Promise.resolve();
	}
	onFilterFetch(filterName, oldValue, newValue) {
		return this.fetchData();
	}
	onLegendChange() {
		return this.fetchData();
	}
  onSelect(selection) {
    return this.fetchData();
  }
	receiveDataOld(...args) {
		if (this.receiveData) {
			console.warn("<AvlMap::MapLayer> You are using the old fetchData / receiveData API. Use the new featchData / render API!");
			this.receiveData(...args);
		}
	}

	render(map) {
	}
	onStyleChange(map) {
		// this._onRemove(map);
		this._onAdd(map);

		this.render(map);
	}

  addOnClick(map) {
    this.onClick.layers.forEach(layer => {
      const func = e => this._mapClick(e, layer);

      this.boundFunctions[`on-click-${ layer }`] = func;

      if (layer === 'map') {
        map.on('click', func);
      }
      else {
        map.on("click", layer, func)
      }
    })
  }
  removeOnClick(map) {
    this.onClick.layers.forEach(layer => {
      const key = `on-click-${ layer }`,
        func = this.boundFunctions[key];

      if (layer === 'map') {
        map.off('click', func);
      }
      else {
        map.off("click", layer, func)
      }

      delete this.boundFunctions[key];
    })
  }
  _mapClick(e, layer) {
    this.onClick.dataFunc.call(this, e.features, e.point, e.lngLat, layer);
  }

	addPopover(map) {
		this.popover.layers.forEach(layer => {

			let key = `${ layer }-mousemove`,
				func = e => this._mousemove(e, layer);
			this.boundFunctions[key] = func;
			map.on("mousemove", layer, func);

			map.on("mouseleave", layer, this._mouseleave);

      if (!this.popover.noSticky && !this.onClick) {
				key = `${ layer }-popover-click`;
				func = e => this._popoverClick(e, layer);
				this.boundFunctions[key] = func;
        map.on("click", layer, func);
      }
		})
	}
	removePopover(map) {
		this.popover.layers.forEach(layer => {

			let key = `${ layer }-mousemove`,
				func = this.boundFunctions[key];
			delete this.boundFunctions[key];
			map.off("mousemove", layer, func);

			map.off("mouseleave", layer, this._mouseleave);

      if (!this.popover.noSticky && !this.onClick) {
				key = `${ layer }-popover-click`;
				func = this.boundFunctions[key];
				delete this.boundFunctions[key];
        map.off("click", layer, func);
      }
		})
	}
	_mousemove(e, layer) {
		this.showPopover = true;

		const { map, popover } = this.component.state,
			zoom = map.getZoom(),
			{ minZoom, dataFunc } = this.popover;

		if (minZoom && (minZoom > zoom)) return;

    if (e.features && e.features.length) {

			const popoverId = ++this.latestPopoverId;

			Promise.resolve(dataFunc.call(this, e.features[0], e.features, layer, map, e) || [])
				.then(data => {
					if (!this.showPopover) return;
					if (popoverId < this.latestPopoverId) return;

					map.getCanvas().style.cursor = data.length ? 'pointer' : '';

			    if (popover.pinned) return;

					this.doAction(["updatePopover", {
		      	pos: [e.point.x, e.point.y],
						layer: this,
		      	data
		      }])
				})
    }
	}
	_mouseleave(e, layer) {
		this.showPopover = false;

		const { map, popover } = this.component.state;

    map.getCanvas().style.cursor = '';

    if (popover.pinned) return;

		this.doAction(["updatePopover", {
				layer: null,
        data: []
    }])
	}
	_clearPinnedState() {
		if (!this.map) return;

		this.pinnedFeatureIds.forEach(layerId => {
			const [layer, id] = layerId.split("."),
				layerData = this.layers.reduce((a, c) =>
					c.id === layer ? ({ source: c.source, sourceLayer: c['source-layer'] }) : a
				, null)
			layerData && this.map.setFeatureState({ id, ...layerData }, { pinned: false });
		})
		this.pinnedFeatureIds.clear();
	}
	_popoverClick(e, layer) {
		const { map, popover } = this.component.state,
    	{ pinned } = popover;

    if (e.features.length) {
    	const data = this.popover.dataFunc.call(this, e.features[0], e.features, layer);
    	if (data.length) {
				if (typeof this.popover.onPinned === "function") {
					this.popover.onPinned.call(this, e.features, e.lngLat, e.point);
				}

				if (this.popover.setPinnedState) {
					this._clearPinnedState();

					e.features.forEach(({ id, layer }) => {
						const layerData = this.layers.reduce((a, c) =>
							c.id === layer.id ? ({ source: c.source, sourceLayer: c['source-layer'] }) : a
						, null)
						if ((id !== undefined) && layerData) {
				      this.pinnedFeatureIds.add(`${ layer.id }.${ id }`);
				      map.setFeatureState({ id, ...layerData }, { pinned: true });
						}
					})
				}

    		if (pinned) {
					this.doAction(["updatePopover", {
    				pos: [e.point.x, e.point.y],
    				data,
						layer: this
    			}])
    		}
    		else {
					this.doAction(["updatePopover", {
    				pinned: true,
						layer: this
    			}])
    		}
    	}
    	// else {
    	// 	this.updatePopover({
    	// 		pinned: false
    	// 	})
    	// }
    }
	}

  _mousedown(e) {
    if (!(e.shiftKey && e.button === 0)) return;

    const { map } = this.component.state;

    map.dragPan.disable();

    const canvas = map.getCanvasContainer(),
      selectFrom = this.select.fromLayers,
      toHighlight = this.select.highlightLayers,
      selectProperty = this.select.property,
      selectFilter = ['in', selectProperty],
      maxSelection = this.select.maxSelection || 5000;

    const mousePos = e => {
      const rect = canvas.getBoundingClientRect();
      return [
        e.clientX - rect.left - canvas.clientLeft,
        e.clientY - rect.top - canvas.clientTop
      ]
    }

    let start = mousePos(e), current, box = null, selection = [];

    const onMouseMove = e => {
      current = mousePos(e);

      if (!box) {
        box = document.createElement('div');
        box.classList.add('boxdraw');
        canvas.appendChild(box);
      }

      var minX = Math.min(start[0], current[0]),
        maxX = Math.max(start[0], current[0]),
        minY = Math.min(start[1], current[1]),
        maxY = Math.max(start[1], current[1]);

      var pos = 'translate(' + minX + 'px,' + minY + 'px)';
      box.style.transform = pos;
      box.style.WebkitTransform = pos;
      box.style.width = maxX - minX + 'px';
      box.style.height = maxY - minY + 'px';
    }
    const onMouseUp = e => {
      finish([start, mousePos(e)]);
    }
    const onKeyDown = e => {
      if (e.keyCode === 27) finish();
    }

    const finish = (bbox) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mouseup', onMouseUp);

      if (box) {
        box.parentNode.removeChild(box);
        box = null;
      }

      if (bbox) {
        var features = map.queryRenderedFeatures(bbox, { layers: selectFrom });

        if (features.length >= maxSelection) {
          map.dragPan.enable();
          return window.alert(`Select a smaller number of features. You selected ${ features.length }. The maximum is ${ maxSelection }.`);
        }

        var filter = features.reduce(function(filter, feature) {
            filter.push(feature.properties[selectProperty]);
            return filter;
        }, selectFilter.slice());

        selection = features.map(d => d.properties[selectProperty])

        toHighlight.forEach(layer => {
          map.setFilter(
            layer.id,
            layer.filter ? ['all', layer.filter, filter] : filter
          );
        })
      }

      map.dragPan.enable();
      this.component.onSelect(this.name, selection);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }
  addBoxSelect(map) {
    this.select.highlightLayers.forEach(layer => {
      map.setFilter(
        layer.id,
        ["in", this.select.property]
      );
    })

    const canvas = map.getCanvasContainer();
    canvas.addEventListener('mousedown', this._mousedown, true);
  }
	removeBoxSelect(map) {
    const canvas = map.getCanvasContainer();
    canvas.removeEventListener('mousedown', this._mousedown, true);
	}

	receiveMessage(action, data) {
		console.warn("<MapLayer.receiveMessage>", this.name, action, "You should override this method!");
	}
}

export default MapLayer
