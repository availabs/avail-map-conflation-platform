import React, {Component} from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import {ArrowRight} from '../common/icons';

import { Tooltip } from '../common/styled-components';

const StyledSidePanelContainer = styled.div`
  z-index: 99;
  height: 100%;
  width: ${ props => props.width + 40 }px;
  display: flex;
  transition: width 250ms;
  position: absolute;
  padding: 20px;
`;

const SideBarContainer = styled.div`
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  align-items: stretch;
  flex-grow: 1;
  overflow: ${ props => props.isOpen && !props.transitioning ? 'visible' : 'hidden' };
`;

const SideBarInner = styled.div`
  background-color: ${props => props.theme.sidePanelBg};
  border-radius: 1px;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const CollapseButton = styled.div`
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  justify-content: center;
  background-color: ${props => props.theme.sideBarCloseBtnBgd};
  border-radius: 1px;
  color: ${props => props.theme.sideBarCloseBtnColor};
  display: flex;
  position: absolute;
  height: 20px;
  width: 20px;
  right: 10px;
  top: 25px;

  :hover {
    cursor: pointer;
    box-shadow: none;
    background-color: ${props => props.theme.sideBarCloseBtnBgdHover};
  }
`;

class SideBar extends Component {
  static defaultProps = {
    width: 300,
    minifiedWidth: 0,
    isOpen: true,
    onOpenOrClose: function noop() {}
  };
  static propTypes = {
    width: PropTypes.number,
    isOpen: PropTypes.bool,
    minifiedWidth: PropTypes.number,
    onOpenOrClose: PropTypes.func
  };

  _onOpenOrClose = () => {
    this.props.onTransitionStart();
    setTimeout(() => {
      this.props.onOpenOrClose(!this.props.isOpen);
    }, 250);
  };

  render() {
    const { isOpen, transitioning, width } = this.props;

    const _width = isOpen && transitioning ? 0
                  : isOpen && !transitioning ? width
                  : !isOpen && transitioning ? 300
                  : 0;

    return (
      <StyledSidePanelContainer
        width={ _width }
        className="side-panel--container"
        isOpen={ isOpen }>

        <SideBarContainer className="side-bar"
          style={ { width: `${ width }px` } }
          isOpen={ isOpen }
          transitioning={ transitioning }>

          { !isOpen && !transitioning ? null :
            <div style={ { width: `${ width }px`, height: "100%" } }>
              <SideBarInner className="side-bar__inner">
                { this.props.children }
              </SideBarInner>
            </div>
          }

        </SideBarContainer>

        <CollapseButton className="side-bar__close"
          onClick={ this._onOpenOrClose }
          data-tip data-for="hide-show-layer-controls">
          <ArrowRight height="12px"
            style={ { transform: `rotate(${ isOpen ? 180 : 0 }deg)` } }/>
        </CollapseButton>
        <Tooltip
          id='hide-show-layer-controls'
          effect="solid"
          place="right">
          <span>{ `${ isOpen ? "Hide" : "Show" } Controls` }</span>
        </Tooltip>

      </StyledSidePanelContainer>
    );
  }
}

export default SideBar
