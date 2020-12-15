import React, {Component} from 'react';

import SidebarContainer from './sidebar'
import SidebarHeader from './SidebarHeader'
import LayerSelector from './LayerSelector'
import ActiveLayers from './ActiveLayers'

import { Layers } from "../common/icons"

import { Tooltip } from '../common/styled-components';

import AccordionSelector from "../AccordianSelector.js"

import deepequal from "deep-equal"
import styled from "styled-components"
import get from "lodash.get"

const SidebarContent = styled.div`
  ${ props => props.theme.scrollBar };
  flex-grow: 1;
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
`

const Pages = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
  padding: 10px 10px 10px 10px;
  color: ${ props => props.theme.inputPlaceholderColor };

  > * {
    padding: 5px;
    cursor: pointer;
    height: 30px;
    width: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: color 0.15s, background-color 0.15s;

    :hover {
      color: ${ props => props.theme.textColorHl };
      background-color: ${ props => props.theme.panelBackgroundHover };
    }
    &.active {
      color: ${ props => props.theme.textColorHl };
      padding-bottom: 3px;
      border-bottom: 2px solid ${ props => props.theme.textColorHl };
    }
  }
`

class Sidebar extends Component {
  state = {
    pages: [],
    activePage: get(this.props, "pages[0].page", this.props.pages[0])
  }
  componentDidMount() {
    this.setState({ pages: this.expandPages() });
  }
  componentDidUpdate(oldProps) {
    if (!deepequal(oldProps.pages, this.props.pages)) {
      this.setState({ pages: this.expandPages() });
    }
  }

  setActivePage(activePage) {
    this.setState({ activePage });
  }
  expandPages() {
    return this.props.pages.map(page => {
      if (page === "layers") {
        return {
          page,
          Icon: () => (
            <div className={ this.state.activePage === page ? "active" : "" }
              onClick={ () => this.setActivePage(page) }
              data-tip data-for="layers-tooltip">
              <Layers width="30px" height="30px"/>
              <Tooltip
                place="bottom"
  	            id="layers-tooltip"
  	            effect="solid"
  	            delayShow={ 500 }>
  	            <span>Layer Controls</span>
  	          </Tooltip>
            </div>
          ),
          Comp: () => (
            <>
              { !this.props.layers.reduce((a, c) => a || !c.active, false) ? null :
                <LayerSelector { ...this.props }/>
              }
              <ActiveLayers { ...this.props }/>
            </>
          )
        }
      }
      if (page === "basemaps") {
        return {
          page,
          Icon: () => (
            <div className={ this.state.activePage === page ? "active" : "" }
              onClick={ () => this.setActivePage(page) }
              data-tip data-for="basemap-tooltip">
              <span className="fa fa-2x fa-map"/>
              <Tooltip
                place="bottom"
  	            id="basemap-tooltip"
  	            effect="solid"
  	            delayShow={ 500 }>
  	            <span>Basemap Selector</span>
  	          </Tooltip>
            </div>
          ),
          Comp: () => (
            <BaseMapsSelector style={ this.props.style }
              setMapStyle={ this.props.setMapStyle }
              styles={ this.props.mapStyles }/>
          )
        }
      }
      return {
        ...page,
        Icon: () => (
          <div className={ this.state.activePage === page.page ? "active" : "" }
            onClick={ () => this.setActivePage(page.page) }
            data-tip data-for={ `tooltip-${ page.page }` }>
            <page.Icon />
            <Tooltip
              place="bottom"
              id={ `tooltip-${ page.page }` }
              effect="solid"
              delayShow={ 500 }>
              { page.tooltip }
            </Tooltip>
          </div>
        ),
        Comp: () => (
          <page.Comp map={ this.props.map }
            layers={ this.props.layers }/>
        )
      };
    })
  }
  render() {
    const { pages } = this.state;

    return (
      <SidebarContainer isOpen={ this.props.isOpen }
        transitioning={ this.props.transitioning }
        onOpenOrClose={ this.props.onOpenOrClose }
        onTransitionStart={ this.props.onTransitionStart }>

        { !this.props.header ? null :
          <SidebarHeader header={ this.props.header }/>
        }

        <Pages>
          {
            pages.map(({ page, Icon }) => <Icon key={ page }/>)
          }
        </Pages>

        <SidebarContent className='sidebar-content' theme={ this.props.theme }>

          {
            pages.map(({ page, Comp }, i) =>
              <div key={ i }
                style={ { display: page === this.state.activePage ? "block" : "none" } }>
                <Comp />
              </div>
            )
          }

        </SidebarContent>

      </SidebarContainer>
    );
  }
}

export default Sidebar

class BaseMapsSelector extends React.Component {
  onSelect(name) {
    const style = this.props.styles.reduce((a, c) => c.name === name ? c : a);
    this.props.setMapStyle(style);
  }
  render() {
    const { styles, style } = this.props,
      options = styles.map(({ name, url }) => ({ label: name, Icon: () => <img src={ url } alt="basemap"/> }));
    return (
      <div>
        <AccordionSelector value={ style.name }
          options={ options }
          onSelect={ v => this.onSelect(v) }/>
      </div>
    )
  }
}
