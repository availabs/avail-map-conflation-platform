import React from "react"

import styled from "styled-components"

import classnames from "classnames"

import { Tooltip } from '../common/styled-components';

import MapStyleControl from "./MapStyleControl"

const ActionContainer = styled.div`
	position: absolute;
	top: ${ props => props.sidebar ? 50 : 20 }px;
	left: ${ props => props.sidebar && props.isOpen ? 340 : props.sidebar && !props.isOpen ? 40 : 20 }px;
	transition: left 0.25s;
	z-index: 50;
	display: flex;
	flex-direction: column;
`
const ActionItem = styled.div`
	position: relative;

	color: #ccc;
	background-color: #999;
  border: 2px solid #999;

	width: 40px;
	height: 40px;
	border-radius: 20px;

	margin-top 10px;
	:first-child {
		margin-top 0px;
	}

	display: flex;
  justify-content: center;
  align-items: center;

  cursor: pointer;

  transition: border-color 0.15s, color 0.15s, background-color 0.15s;

  :hover {
  	border: 2px solid #fff;
		color: #fff;
		background-color: #aaa;
  }
  &.disabled {
  	pointer-events: all;
  	cursor: not-allowed;
  	color: #aaa;
		background-color: #888;
		border-color: #888;
  }
  &.disabled:hover {
  	border-color: ${ props => props.theme.errorColor };
  }

	svg {
		width: 40px;
		height: 40px;
		border-radius: 20px;

		display: block;
		position: absolute;
		top: -2px;
		left: -2px;

		line {
			stroke: ${ props => props.theme.errorColor };
			stroke-width: 4px;
			transition: stroke 0.15s;
		}
		:hover line {
			stroke: ${ props => props.theme.errorColor };
		}
	}
`

const NO_OP = () => {};

class MapActions extends React.Component {
	MOUNTED = false;
	state = {
		waitingActions: []
	}
	componentDidMount() {
		this.MOUNTED = true;
	}
	componentWillUnmount() {
		this.MOUNTED = false;
	}
	doAndPauseAction(e, disableFor, action, id) {
		action(e);

		const waitingActions = [...this.state.waitingActions, id];
		this.setState({ waitingActions });

		setTimeout(() => {
			const waitingActions = this.state.waitingActions.filter(d => d !== id);
			this.MOUNTED && this.setState({ waitingActions });
		}, disableFor);
	}
	render() {
		const actions = this.props.layers
			.filter(l => this.props.activeLayers.includes(l.name))
			.reduce((actions, layer) => {
				if (layer.active) {
					actions.push(
						...Object.keys(layer.mapActions)
							.map(actionName => {
								const id = `${ layer.name }-${ actionName }`;
								const {
									action = NO_OP,
									disabled = false,
									disableFor = 0,
									...rest
								} = layer.mapActions[actionName];
								const isDisabled = disabled || this.state.waitingActions.includes(id);

								let boundAction = NO_OP.bind(layer);

								if (Array.isArray(action)) {
									const a = action[0];
									if (a in this.props.actionMap) {
										boundAction = this.props.actionMap[a].bind(layer, layer.name, ...action.slice(1));
									}
								}
								else {
									boundAction = action.bind(layer);
								}
								return {
									action: disableFor ? e => this.doAndPauseAction(e, disableFor, boundAction, id) : boundAction,
									id,
									layer,
									disabled: isDisabled,
									...rest
								}
							})
					);
				}
				return actions;
			}, [])
		return (
			<ActionContainer sidebar={ this.props.sidebar } isOpen={ this.props.isOpen }>
				{ !this.props.showStyleControl ? null :
					<MapStyleControl setMapStyle={ this.props.actionMap["setMapStyle"] }
						getStaticImageUrl={ this.props.getStaticImageUrl }
						mapStyles={ this.props.mapStyles }
						style={ this.props.style }/>
				}
				{ !this.props.showMapActions ? null :
					actions.map(({ Icon, id, tooltip, action, disabled, layer }) =>
						<ActionItem key={ id }
							data-tip data-for={ id }
          		onClick={ disabled ? null : action }
          		className={ classnames({ disabled }) }>

							<Icon layer={ layer }/>
		          <Tooltip
		            id={ id }
		            effect="solid"
		            place="right">
		            <span>{ typeof tooltip === "function" ? tooltip({ layer }) : tooltip }</span>
		          </Tooltip>

		          { !disabled ? null :
			          <svg>
			          	<line x1="40" x2="0" y1="0" y2="40"/>
			          </svg>
			        }

						</ActionItem>
					)
				}
			</ActionContainer>
		)
	}
}

export default MapActions
