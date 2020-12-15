import React from "react"

import styled from "styled-components"

import { Tooltip } from '../common/styled-components';

const StyledControl = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #999;
  position: absolute;
  cursor: pointer;
  border: 2px solid #999;
  border-color: ${ props => props.showActive ? "#fff" : "#999" };
  :hover {
    border-color: #fff;
  }
`
const ControlContainer = styled.div`
  position: relative;
  width: 44px;
  height: 44px;
  margin-left: -2px;
`

export default ({ mapStyles, style, getStaticImageUrl, setMapStyle }) => {
  const [isOpen, setOpen] = React.useState(false),

    clicked = React.useCallback(style => {
      if (!isOpen) {
        setOpen(true);
      }
      else {
        setMapStyle(style);
        setOpen(false);
      }
    }, [isOpen]);

  const styles = mapStyles.map(s => ({
    ...s,
    url: getStaticImageUrl(s.style.slice(23), [40, 40]),
    active: s.name === style.name
  }))
  return (
    <ControlContainer>
      { styles.map((style, i) =>
          <StyledControl key={ style.name }
            showActive={ isOpen && style.active }
						data-tip data-for={ style.name }
            style={ {
              top: "0px",
              left: isOpen ? `${ i * 50 }px` : "0px",
              zIndex: style.active ? 100 : 0,
              transition: "left 0.25s"
            } }
            onClick={ e => clicked(style) }>
            <img src={ style.url }/>
            <Tooltip id={ style.name }
              effect="solid"
              place="top">
              <span>{ style.name }</span>
            </Tooltip>
          </StyledControl>
        )
      }
    </ControlContainer>
  )
}
