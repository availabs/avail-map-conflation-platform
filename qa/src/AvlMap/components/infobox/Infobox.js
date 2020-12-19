import React, {Component} from 'react';

import styled from "styled-components"

import Legend from '../legend/Legend'

const InfoBoxContainer = styled.div`
  position: relative;
  min-height: 25px;
`
const ToggleButton = styled.span`
  position: absolute;
  top: 0px;
  right: 0px;
  padding: 5px 8px 8px 8px;
  border-radius: 4px;
  color: ${ props => props.theme.textColor };
  background-color: transparent;
  transition: colors 0.15s, background-color 0.15s;

  :hover {
    color: ${ props => props.theme.textColorHl };
    background-color: ${ props => props.theme.panelBackgroundHover };
  }
`
const CollapsedInfoBox = styled.div`
  color: ${ props => props.theme.inputPlaceholderColor };
  font-weight: bold;
  font-size: 1.5rem;
  line-height: 1.5rem;
`
const OpenInfoBoxTitle = styled.div`
  color: ${ props => props.theme.textColorHl };
  font-weight: bold;
  font-size: 1.5rem;
  line-height: 1.5rem;
`

const SidebarContainer = styled.div`
  ${ props => props.theme.scrollBar };
  width: ${ props => props.isOpen ? 400 : 0 }px;
  z-index: 99;
  display: flex;
  position: absolute;
  padding: 20px;
  top: 0px;
  right: 0px;
  max-height: calc(100vh - 100px);
  pointer-events: none;
`
const SidebarInner = styled.div`
  ${ props => props.theme.scrollBar };
  background-color: ${ props => props.theme.sidePanelBg };
  display: flex;
  flex-direction: column;
  height: 100%;
  pointer-events: all;
`
const SidebarContent = styled.div`
  ${ props => props.theme.scrollBar };
  flex-grow: 1;
  padding: ${ props => props.isOpen ? 10 : 0 }px;
/*
  overflow-y: auto;
  overflow-x: hidden;
*/
  overflow: auto;
  color: ${ props => props.theme.textColor };

  > * {
    margin-bottom: 10px;
  }
  > *:last-child {
    margin-bottom: 0px;
  }
`

class InfoBox extends Component {

  state = {
    collapsedInfoBoxes: []
  }

  toggleInfoBox(id) {
    const { collapsedInfoBoxes } = this.state;
    if (collapsedInfoBoxes.includes(id)) {
      this.setState({ collapsedInfoBoxes: collapsedInfoBoxes.filter(d => d !== id) });
    }
    else {
      this.setState({ collapsedInfoBoxes: [...collapsedInfoBoxes, id] });
    }
  }

  getToggleButton(id) {
    return `fa fa-lg
      ${ this.state.collapsedInfoBoxes.includes(id) ? "fa-chevron-down" : "fa-chevron-up" }
    `;
  }

  render() {

    const { layers, activeLayers } = this.props,
      _activeLayers = layers.filter(l => activeLayers.includes(l.name)),
      activeLegends = _activeLayers
        .reduce((a, c) =>
          c.legend && (c.legend.active !== false) && c.legend.domain.length ? a.concat({ legend: c.legend, layer: c }) : a
        , []),
      activeInfoBoxes = _activeLayers
        .reduce((a, c) =>
          c.infoBoxes ?
            a.concat(
              Object.keys(c.infoBoxes)
                .map((key, i) => ({
                  title: `${ c.name } ${ key }`,
                  ...c.infoBoxes[key],
                  id: `${ c.name }-${ key }`,
                  layer: c
                }))
                .filter(i => i.show)
            )
            : a
        , []),

      isOpen = activeLegends.length || activeInfoBoxes.length;

    let sidebarStyle = {
      alignItems: 'stretch',
      flexGrow: 1
    }

    return (
      <SidebarContainer className='sidebar-container' isOpen={ isOpen }>
        <div className='sidebar' style={sidebarStyle}>
          <SidebarInner className='sidebar-inner' isOpen={ isOpen }>
            <SidebarContent className='sidebar-content' isOpen={ isOpen }>
              {
                activeLegends.map((l, i) =>
                  <Legend key={ i } { ...l.legend } layer={ l.layer }/>
                )
              }
              {
                activeInfoBoxes.map((b, i) =>
                  <InfoBoxContainer key={ i }>
                    { this.state.collapsedInfoBoxes.includes(b.id) ?
                        (typeof b.title === "function") ?
                          <CollapsedInfoBox><b.title layer={ b.layer }/></CollapsedInfoBox>
                        : <CollapsedInfoBox>{ b.title }</CollapsedInfoBox>
                      :
                        <>
                          {
                            (typeof b.title === "function") ?
                              <OpenInfoBoxTitle><b.title layer={ b.layer }/></OpenInfoBoxTitle>
                            : <OpenInfoBoxTitle>{ b.title }</OpenInfoBoxTitle>
                          }
                          <b.comp layer={ b.layer }/>
                        </>
                    }
                    <ToggleButton className={ this.getToggleButton(b.id) }
                      onClick={ () => this.toggleInfoBox(b.id) }/>
                  </InfoBoxContainer>
                )
              }
            </SidebarContent>
          </SidebarInner>
        </div>
      </SidebarContainer>
    );
  }
}

export default InfoBox
