import React, {Component} from 'react';
import styled from 'styled-components';
// import PropTypes from 'prop-types';
import classnames from 'classnames';
import {CenterFlexbox} from '../common/styled-components';
import {Pin, Layers} from '../common/icons';

const MAX_WIDTH = 400;
const MAX_HEIGHT = 600;

const StyledMapPopover = styled.div`
  ${props => props.theme.scrollBar}
  font-size: 11px;
  font-weight: 500;
  background-color: ${props => props.theme.panelBackground || '#fefefe'};
  color: ${props => props.theme.textColor};
  z-index: 1001;
  position: absolute;
  overflow-x: auto;
  max-height: 500px;
  .gutter {
    height: 6px;
  }
  table {
    width: 100%;
    tbody {
      border-top: transparent;
      border-bottom: transparent;
    }
    td {
      border-color: transparent;
      padding: 0px 4px;
      color: ${props => props.theme.textColor};
    }
    td.row__value {
      text-align: right;
      font-weight: 500;
      color: ${props => props.theme.textColorHl};
    }
  }
`;

const StyledPin = styled.div`
  position: absolute;
  left: 50%;
  transform: rotate(30deg);
  top: 3px;
  color: ${props => props.theme.primaryBtnBgd};
  :hover {
    cursor: pointer;
    color: ${props => props.theme.linkBtnColor};
  }
`;

const StyledLayerName = styled(CenterFlexbox)`
  color: ${props => props.theme.textColorHl};
  font-size: 12px;
  letter-spacing: 0.43px;
  text-transform: capitalize;
  padding-left: 14px;
  padding-right: 14px;
  margin-top: 12px;
  svg {
    margin-right: 4px;
  }
`;

const PopoverBlock = styled.div`
  max-width: 400px;
  margin: 10px;
`
const PopoverBlockContainer = styled.div`
  ${PopoverBlock} {
    border-bottom: 2px solid ${ props => props.theme.textColor };
  }
  ${PopoverBlock}:last-child {
    border-bottom: none;
  }
`

export class MapPopover extends Component {

  state = {
    isMouseOver: false,
    width: 380,
    height: 160,
    promise: null,
    data: ["Loading..."]
  }

  componentDidMount() {
    this._setContainerSize();
  }

  componentDidUpdate() {
    this._setContainerSize();
  }

  _setContainerSize() {
    const node = this.popover;
    if (!node) {
      return;
    }

    const width = Math.min(node.scrollWidth, MAX_WIDTH);
    const height = Math.min(node.scrollHeight, MAX_HEIGHT);

    if (width !== this.state.width || height !== this.state.height) {
      this.setState({width, height});
    }
  }

  _getPosition(x, y) {
    const topOffset = 30;
    const leftOffset = 30;
    const {mapSize} = this.props;
    const {width, height} = this.state;

    const pos = {};
    if (x + leftOffset + width > mapSize.width) {
      pos.right = mapSize.width - x + leftOffset;
    } else {
      pos.left = x + leftOffset;
    }

    if (y + topOffset + height > mapSize.height) {
      pos.bottom = 10;
    } else {
      pos.top = y + topOffset;
    }

    return pos;
  }

  render() {
    const {
      pinned,
      data,
      pos
    } = this.props;

    if (!data.length) {
      return null;
    }

    const hidden = !data.length && !this.state.isMouseOver;

    const [x, y] = pos;

    const style =
      Number.isFinite(x) && Number.isFinite(y) ? this._getPosition(x, y) : {};

    const blockData = data[0] === "avl-blocked-popover" ? data.slice(1) : [data];

    return (
      <StyledMapPopover
        ref={ comp => { this.popover = comp; } }
        className={ classnames('map-popover', {hidden}) }
        style={ { ...style } }
        onMouseEnter={ () => this.setState({ isMouseOver: true }) }
        onMouseLeave={ () => this.setState({ isMouseOver: false }) }>

        { pinned ?
          <div className="map-popover__top">
            <StyledPin className="popover-pin" onClick={e => this.props.updatePopover(this.props.layer, { layer: null, pinned: false, data: [] })}>
              <Pin height="16px" />
            </StyledPin>
            <div style={ { height: "10px" } }/>
          </div>
        : null }
        <PopoverBlockContainer>
          {
            blockData.map((block, i) => (
              <PopoverBlock key={ i }>
                { !Array.isArray(block[0]) ?
                  <StyledLayerName className="map-popover__layer-name">
                    <Layers height="12px"/>{ block[0] }
                  </StyledLayerName>
                : null }
                { Array.isArray(block[0]) || (!Array.isArray(block[0]) && block.length > 1) ?
                  <table className="map-popover__table">
                    <tbody>
                      {
                        block.slice(Array.isArray(block[0]) ? 0 : 1)
                          .map(PopoverRow)
                      }
                    </tbody>
                  </table>
                : null }
              </PopoverBlock>)
            )
          }
        </PopoverBlockContainer>
      </StyledMapPopover>
    );
  }
}

const PopoverRow = (row, i) =>
  row.length === 2 ?
    <tr key={ "row2-" + i }>
      <td className="row__name">{ row[0] }</td>
      <td className="row__value">{ row[1] }</td>
    </tr>
  :
    <tr key={ "row1-" + i }>
      <td colSpan={ 2 } className="row__value">{ row[0] }</td>
    </tr>

export default MapPopover
