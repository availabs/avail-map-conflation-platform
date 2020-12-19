import React from "react"

import styled from "styled-components"
import classnames from "classnames"

import onclickoutside from "react-onclickoutside"

const PADDING = 10;
class AccordionSelector extends React.Component {
  static defaultProps = {
    value: null,
    options: [],
    onSelect: () => {}
  }
  state = {
    open: false
  }
  timeout = null;
  componentsWillUnmount() {
    clearTimeout(this.timeout);
  }
  onSelect(e, value) {
    e.stopPropagation();
    if (!this.state.open) {
      return this.toggleAccordion();
    }
    if (value !== this.props.value) {
      this.props.onSelect(value);
    }
    this.toggleAccordion();
  }
  toggleAccordion() {
    const open = !this.state.open;
    this.setState({ open });
  }
  handleClickOutside() {
    this.state.open && this.toggleAccordion();
  }
  render() {
    const { open } = this.state,
      { options, value } = this.props;
    return (
      <AccordionContainer
        style={ { height: `${ open ? options.length * 40 + (options.length - 1) * 10 + PADDING * 2 : 40 + PADDING * 2 }px` } }>
        {
          options
            .map(({ label, Icon }, i) =>
              <AccordionOption key={ label } hasIcon={ Boolean(Icon) }
                className={ classnames({ open, selected: label === value }) }
                style={ {
                  top: `${ open ? i * 50 + PADDING : PADDING }px`,
                  zIndex: label === value ? 10 : 5 - i
                } }
                onClick={ e => this.onSelect(e, label) }
                top={ i * 50 + PADDING }>
                { !Boolean(Icon) ? null :
                  <div><Icon /></div>
                }
                <div>{ label }</div>
              </AccordionOption>
            )
        }
      </AccordionContainer>
    )
  }
}
export default onclickoutside(AccordionSelector)

const AccordionContainer = styled.div`
  position: relative;
  width: 100%;
  transition: height 0.5s;
  background-color: ${ props => props.theme.sidePanelHeaderBg };
`
const AccordionOption = styled.div`
  background-color: ${ props => props.theme.sidePanelBg };
  color: ${ props => props.theme.textColor };
  cursor: pointer;
  position: absolute;
  left: ${ PADDING }px;
  height: 40px;
  width: calc(100% - ${ PADDING * 2 }px - 2px);
  display: flex;
  flex-direction: row;
  overflow: hidden;
  border-right: 2px solid ${ props => props.theme.sidePanelBg };
  transition: top 0.5s, color 0.15s, background-color 0.15s, border-color 0.15s;

  &.selected.open {
    border-right-color: ${ props => props.theme.textColorHl };
    color: ${ props => props.theme.textColorHl };
  }

  :hover {
    border-right-color: ${ props => props.theme.panelBackgroundHover };
    background-color: ${ props => props.theme.panelBackgroundHover };
    color: ${ props => props.theme.textColorHl };
  }

  > * {
    :first-child {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 60px;
      height: 40px;
    }
    :last-child {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      width: calc(100% - ${ props => props.hasIcon ? 60 : 0 }px);
      padding-left: 10px;
    }
  }
`