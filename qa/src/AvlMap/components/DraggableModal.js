import React from "react"

import { VertDots } from "./common/icons"

import { Tooltip } from './common/styled-components';

import styled from "styled-components"
import get from "lodash.get"

import * as d3selection from "d3-selection"

const DraggableContainer = styled.div`
	position: absolute;
	z-index: 500;
	background-color: ${ props => props.theme.sidePanelBg };
	color: ${ props => props.theme.textColor };
`
const DraggableInner = styled.div`
	${ props => props.theme.scrollBar };
	overflow: auto;
	width: 100%;
	height: 100%;
	padding-top: 35px;
`

const DragHandle = styled.div`
	position: absolute;
	top: 5px;
	left: 5px;
	border-radius: 4px;
	color: ${ props => props.theme.textColor };
	z-index: 50;
	transition: color 0.15s, background-color 0.15s;

	svg {
		display: block;
	}

	:hover {
		color: ${ props => props.theme.textColorHl };
		background-color: ${ props => props.theme.panelBackgroundHover };
	}
`
const ResizeHandle = styled.div`
	position: absolute;
	bottom: 5px;
	right: 5px;
	width: 25px;
	height: 25px;
	border-right: 2px solid ${ props => props.theme.textColor };
	border-bottom: 2px solid ${ props => props.theme.textColor };
	z-index: 50;
	transition: color 0.15s, background-color 0.15s;

	:hover {
		border-right: 3px solid ${ props => props.theme.textColorHl };
		border-bottom: 3px solid ${ props => props.theme.textColorHl };
	}
`

const CloseWrapper = styled.div`
	display: inline-block;
	color: ${ props => props.theme.textColor };
	position: absolute;
	right: 5px;
	top: 5px;
	cursor: pointer;
	padding: 0px 4px 0px 4px;
	border-radius: 4px;

	:hover {
		color: ${ props => props.theme.textColorHl };
		background-color: ${ props => props.theme.panelBackgroundHover };
	}
`

const noop = () => {}

export default class DraggableModal extends React.Component {
	static defaultProps = {
		startPos: "bottom",
		startSize: [800, 500],
		minWidth: 200,
		minHeight: 200,
    onClose: noop,
    meta: null,
    resizeOnIdChange: false
	}
	container = null;
	dragHandle = null;
	resizeHandle = null;
	state = {
		pos: [0, 0],
		dragging: false,
		resizing: false,
		prevPos: [0, 0],
		size: [...this.props.startSize]
	}
	componentDidMount() {
		d3selection.select(this.dragHandle)
			.on("mousedown.avl", () => this.startDragOrResize("dragging"), { bubbles: false })

		d3selection.select(this.resizeHandle)
			.on("mousedown.avl", () => this.startDragOrResize("resizing"), { bubbles: false });

    this.setState((state, props) => {
			if (!this.container) return null;

      if (this.resizeOnIdChange()) return null;

      const [width, height] = state.size,
				parent = this.container.parentElement,
  			clientWidth = parent.clientWidth,
  			clientHeight = parent.clientHeight;

      if (typeof props.startPos === "string") {
        switch (props.startPos) {
          	case "top":
            	return { pos: [clientWidth * 0.5 - width * 0.5, 20] };
          	case "bottom":
            	return { pos: [clientWidth * 0.5 - width * 0.5, clientHeight - height - 20] };
			case "bottom-right":
				return { pos: [clientWidth - width - 50, clientHeight - height - 20] };
			default:
				return { pos: [...props.startPos] };
        }
      }
      else {
        return { pos: [...props.startPos] };
      }

      
    })
	}
	componentWillUnmount() {
		d3selection.select(document.body)
			.on("mousemove.avl", null)
			.on("mouseleave.avl", null)
			.on("mouseup.avl", null);
	}
  resizeOnIdChange(oldProps) {
    if (this.props.show && this.props.resizeOnIdChange &&
      (get(oldProps, 'meta.id', undefined) !== get(this.props, 'meta.id', undefined))) {

      const size = [...get(this.props, 'meta.startSize', this.state.size)],
        startPos = get(this.props, 'meta.startPos', this.props.startPos);

      let pos = [...this.state.pos];

      const [width, height] = size,
				parent = this.container.parentElement,
  			clientWidth = parent.clientWidth,
  			clientHeight = parent.clientHeight;

      if (typeof startPos === "string") {
        switch (startPos) {
          case "top": {
            pos = [clientWidth * 0.5 - width * 0.5, 20];
            break;
          }
          case "bottom": {
            pos = [clientWidth * 0.5 - width * 0.5, clientHeight - height - 20];
            break;
          }
			case "bottom-right":
			pos = [clientWidth - width - 50, clientHeight - height - 20];
			break;
			default: {
				pos = [...startPos];
				break;
			}
        }
      }
      else {
        pos = [...startPos];
      }

      this.setState({ size, pos });

      return true;
    }
    return false;
  }
  componentDidUpdate(oldProps) {
    this.resizeOnIdChange(oldProps);
  }
	startDragOrResize(type) {
		d3selection.select(document.body)
			.on("mousemove.avl", this.dragOrResize.bind(this))
			.on("mouseleave.avl", this.endDragOrResize.bind(this))
			.on("mouseup.avl", this.endDragOrResize.bind(this));

		d3selection.event.stopPropagation();
		d3selection.event.preventDefault();

		const prevPos = d3selection.mouse(document.body);
		this.setState({ [type]: true, prevPos });
	}
	dragOrResize() {
		d3selection.event.stopPropagation();
		d3selection.event.preventDefault();

		const [x1, y1] = this.state.prevPos,
			[x2, y2] = d3selection.mouse(document.body);

		if (this.state.dragging) {
			const [x, y] = this.state.pos;

			const newState = {
				pos: [Math.max(0, x + (x2 - x1)), Math.max(0, y + (y2 - y1))],
				prevPos: [x2, y2]
			};

			this.setState(newState)
		}
		else if (this.state.resizing) {
			const [width, height] = this.state.size;

			const {
				minWidth,
				minHeight
			} = this.props;

			const newState = {
				size: [Math.max(minWidth, width + (x2 - x1)), Math.max(minHeight, height + (y2 - y1))],
				prevPos: [x2, y2]
			};

			this.setState(newState)
		}
	}
	endDragOrResize() {
		d3selection.select(document.body)
			.on("mousemove.avl", null)
			.on("mouseleave.avl", null)
			.on("mouseup.avl", null);

		d3selection.event.stopPropagation();
		d3selection.event.preventDefault();

		this.setState({ dragging: false, resizing: false })
	}
	render() {
		const {
			pos: [left, top],
			size: [width, height]
		} = this.state;
		return (
			<DraggableContainer
				style={ {
					left: `${ Math.max(0, left) }px`,
					top:`${ Math.max(0, top) }px`,
					width: `${ width }px`,
					height: `${ height }px`,
					display: this.props.show ? "block" : "none"
				} }
				ref={ comp => this.container = comp }>

				<DraggableInner>
					{ this.props.children }
				</DraggableInner>

				<CloseWrapper onClick={ this.props.onClose }>
					<span className="fa fa-2x fa-close" data-tip data-for="close-modal-btn"/>
          <Tooltip
            id="close-modal-btn"
            effect="solid"
            delayShow={ 500 }>
            <span>Close Modal</span>
          </Tooltip>
				</CloseWrapper>

				<DragHandle ref={ comp => this.dragHandle = comp }
					style={ { cursor: this.state.dragging ? "grabbing" : "grab" } }
					onMouseDown={ e => e.stopPropagation() }>
					<VertDots height="26px"/>
				</DragHandle>

				<ResizeHandle ref={ comp => this.resizeHandle = comp }
					style={ { cursor: "nwse-resize" } }/>

			</DraggableContainer>
		)
	}
}