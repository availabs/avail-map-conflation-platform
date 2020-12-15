import React from "react"

import styled from "styled-components"
import deepequal from "deep-equal"

import AvlTable from "../AvlTable"

class AttributesTable extends React.Component {
	static defaultProps = {
		layer: {},
		queryLayers: [],
		dataFunc: null,
		tableKeys: [],
		injectFunc: () => [],
		filterKey: null
	}
	constructor(props) {
		super(props);

		this.state = {
			mapLoaded: false,
			needsUpdate: false,
			features: [[], []],
			queriedFeatures: 0,
			sourcesLoaded: {}
		}

		this.timeout = null;

		this.checkSourcesLoaded = this.checkSourcesLoaded.bind(this);
		this.setNeedsUpdate = this.setNeedsUpdate.bind(this);
		this.initialRender = this.initialRender.bind(this);
	}
	// shouldComponentUpdate(nextProps, nextState) {
	// 	const { features: thisFeatures, ..._thisState } = this.state,
	// 		{ features: nextFeatures, ..._nextState } = nextState;
	//
	// 	return !nextState.mapLoaded ||
	// 		!this.state.queriedFeatures && nextState.queriedFeatures ||
	// 		!deepequal(_thisState, _nextState);
	// }
	componentDidMount() {
		this.checkSourcesLoaded();
		this.queryRenderedFeatures();
	}
	componentWillUnmount() {
		const { map } = this.props.layer;
		if (Boolean(map)) {
			map.off("sourcedata", this.checkSourcesLoaded);
			map.off("zoomend", this.setNeedsUpdate);
			map.off("moveend", this.setNeedsUpdate);
			map.off("style.load", this.setNeedsUpdate);
		}
		clearTimeout(this.timeout);
	}
	componentDidUpdate(oldProps, oldState) {
		const { map } = this.props.layer;
		if (Boolean(map) && !this.state.mapLoaded) {
			this.setState({ mapLoaded: true });
			map.on("sourcedata", this.checkSourcesLoaded);
			map.on("zoomend", this.setNeedsUpdate);
			map.on("moveend", this.setNeedsUpdate);
			map.on("style.load", this.setNeedsUpdate);
		}
		if (Object.values(this.state.sourcesLoaded).reduce((a, c) => a && c, true)) {
			map.off("sourcedata", this.checkSourcesLoaded);
			!this.timeout && this.initialRender();
		}
	}
	initialRender() {
		if (!this.state.queriedFeatures) {
			this.queryRenderedFeatures();
			this.timeout = setTimeout(this.initialRender, 250);
		}
	}
	setNeedsUpdate() {
		this.setState({ needsUpdate: true });
	}
	checkSourcesLoaded() {
		const { map } = this.props.layer,
			sourcesLoaded = this.props.layer.layers
				.reduce((a, c) => {
					if (map && Boolean(map.getSource(c.source))) {
						a[c.source] = true;
					}
					else {
						a[c.source] = false;
					}
					return a;
				}, {});
		if (!deepequal(sourcesLoaded, this.state.sourcesLoaded)) {
			this.setState({ sourcesLoaded });
		}
	}

	queryRenderedFeatures() {
		const {
			layer,
			queryLayers
		} = this.props;

		const { map } = layer;

		if (!map) return [[], []];

		let data = [],
			keys = { layer: true };

		const sourceData = [],
			layers = queryLayers.length ? queryLayers : layer.layers.map(({ id }) => id);

		layer.layers.forEach(l => {
			if (layers.includes(l.id)) {
				sourceData.push([l["source"], l["source-layer"], l["id"]])
			}
		})
		sourceData.forEach(([sourceId, sourceLayer, layer]) => {
			map.querySourceFeatures(sourceId, { sourceLayer })
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

		// const options = {
		// 	layers: queryLayers.length ? queryLayers : layer.layers.map(({ id }) => id)
		// };
		//
		// map.queryRenderedFeatures(options)
		// 	.forEach(feature => {
		// 		const _keys = Object.keys(feature.properties);
		// 		_keys.forEach(key => keys[key] = true);
		// 		const row = { layer: feature.layer.id };
		// 		_keys.forEach(key => {
		// 			row[key] = feature.properties[key];
		// 		})
		// 		data.push(row);
		// 	})

		const { dataFunc } = this.props;
		if (dataFunc !== null) {
			data = data.map(dataFunc);
		}

		const queriedFeatures = data.length;

		let injectedRows = this.props.injectFunc(),
			{ filterKey } = this.props;
		if (injectedRows.length && (filterKey !== null)) {
			const keys = data.reduce((a, c) => {
				a[c[filterKey]] = true;
				return a;
			}, {});
			injectedRows = injectedRows.filter(d => !keys[d[filterKey]]);
		}
		if (dataFunc !== null) {
			injectedRows = injectedRows.map(dataFunc);
		}
		if (injectedRows.length) {
			data = [
				...data,
				...injectedRows
			]
		}

		keys = injectedRows.reduce((keys, row) => ({
			...keys,
			...Object.keys(row).reduce((a, c) => ({ ...a, [c]: true }), {})
		}), keys)

		const { tableKeys } = this.props;
		if (tableKeys.length) {
			keys = tableKeys;
		}
		else {
			keys = Object.keys(keys);
		}

		this.setState({ features: [keys, data], queriedFeatures, needsUpdate: false, loading: false });
	}

	render() {
		const [keys, data] = this.state.features;

		return (
			<div style={ { width: "100%" } }>

				<button className="btn btn-sm btn-outline-success"
					style={ { margin: "10px 0px" } }
					onClick={ () => { this.setState({ page: 0 }); this.queryRenderedFeatures(); } }
					disabled={ !this.state.needsUpdate }>
					Load Table
				</button>

				<Container>
					<AvlTable data={ data }
						keys={ this.props.tableKeys.length ? this.props.tableKeys : keys }
							  expandable={this.props.expandable || []} // array of expandable columns
							  isMulti={true} // multi select filter
					/>
				</Container>

			</div>
		)
	}
}

export default AttributesTable

const Container = styled.div`
	${ props => props.theme.scrollBar };
	/*overflow: auto;*/
	color: ${ props => props.theme.textColor };
`
