import React from 'react';
import styled from 'styled-components';

const CheckboxContainer = styled.div`
  margin-top: 15px;
  margin-bottom: 10px;
  padding: 8px 10px;
  position: relative;
  display: flex;
  background-color: ${ props => props.theme.secondaryInputBgd };
  transition: ${ props => props.theme.transition };
  cursor: pointer;
  border-radius: 2px;
  :hover {
    background-color: ${ props => props.theme.secondaryInputBgdHover };
  }
`
const SliderTrack = styled.div`
  position: absolute;
  height: ${ props => props.theme.switchBtnHeight };
  width: ${ props => parseInt(props.theme.switchBtnWidth) * 2 }px;
  right: 10px;
`
const Square = styled.div`
  width: ${ props => props.theme.switchBtnWidth };
  height: ${ props => props.theme.switchBtnHeight };
  position: absolute;
  top: 0px;
`
const ActiveSquare = styled(Square)`
  background-color: ${ props => props.theme.activeColor };
  left: 0px;
`
const InactiveSquare = styled(Square)`
  background-color: ${ props => props.theme.switchTrackBgd };
  left: ${ props => props.theme.switchBtnWidth };
`
const SliderSquare = styled(Square)`
  background-color: ${ props => props.checked ? props.theme.textColorHl : props.theme.textColor };
  transition: ${ props => props.theme.transitionFast };
  left: ${ props => props.checked ? props.theme.switchBtnWidth : 0 };
`
const CheckboxLabel = styled.label`
  color: ${ props => props.theme.textColor };
  margin: 0px;
  line-height: ${ props => props.theme.switchBtnHeight };
  cursor: pointer;
`

class CheckboxFilter extends React.Component {
  static defaultProps = {
    checked: false
  }
  render() {
    return (
      <CheckboxContainer onClick={ e => this.props.onChange(!this.props.checked) }
        style={ this.props.style }>

        <CheckboxLabel>
          { this.props.label }
        </CheckboxLabel>

        <SliderTrack>
          <ActiveSquare />
          <InactiveSquare />
          <SliderSquare checked={ this.props.checked }/>
        </SliderTrack>

      </CheckboxContainer>
    )
  }
}
export default CheckboxFilter
