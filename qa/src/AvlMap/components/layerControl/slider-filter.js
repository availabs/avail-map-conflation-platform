import React from "react"

import { PanelLabel  } from '../common/styled-components';

import styled from "styled-components"

const StyledContainer = styled.div`
  margin-bottom: 10px;
`
const StyledSliderTrack = styled.div`
  width: 100%;
  height: 10px;
  background-color: ${ props => props.theme.sliderBarBgd };
  border-radius: 2px;
  position: relative;
`
const StyledSliderHandle = styled.div`
  width: 10px;
  height: 20px;
  transform: translate(-50%, -50%);
  position: absolute;
  background-color: ${ props => props.theme.sliderHandleColor };
  top: 50%;
  border-radius: 2px;
`

class SliderFilter extends React.Component {
  static defaultProps = {
    min: 0,
    max: 1,
    value: 1,
    onChnage: () => {}
  }
  track = null;
  state = {
    dragging: false,
    startX: 0
  }
  dragStart = e => {
    e.preventDefault();
    document.addEventListener('mouseup', this.dragEnd);
    document.addEventListener('mousemove', this.drag);
    this.setState({ dragging: true });
  }
  drag = e => {
    e.preventDefault();
    const percent = e.movementX / this.track.offsetWidth,
      range = this.props.max - this.props.min,
      delta = percent * range;
    this.props.onChange(Math.max(this.props.min, Math.min(this.props.max, delta + this.props.value)));
  }
  dragEnd = e => {
    document.removeEventListener('mouseup', this.dragEnd);
    document.removeEventListener('mousemove', this.drag);
    this.setState({ dragging: false });
  }
  render() {
    const { min, max, value } = this.props,
      percent = (value - min) / (max - min) * 100;
    return (
      <StyledContainer>
        <PanelLabel>
          { this.props.name }
        </PanelLabel>
        <StyledSliderTrack ref={ comp => this.track = comp }>
          <StyledSliderHandle
            style={ { left: `${ percent }%` } }
            onMouseDown={ e => this.dragStart(e) }/>
        </StyledSliderTrack>
      </StyledContainer>
    )
  }
}

export default SliderFilter
