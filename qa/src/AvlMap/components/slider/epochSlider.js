
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

//import { setEpoch } from '../../store/MapStore'

// import classnames from 'classnames';
import styled from 'styled-components';
import {Input} from 'components/common/styled-components';

import Slider from './slider'

function noop() {}

const sliderStyle =  {
    width: '100%',
    height: 24,
    background: '#d3d3d3',
    outline: 'none',
    opacity: '0.7',
    // WebkitTransition: 'opacity .15s ease-in-out',
    transition: 'opacity .15s ease-in-out'
}

const SliderInput = styled(Input)`
  height: 24px;
  width: 40px;
  padding: 4px 6px;
  margin-left: ${props => props.flush ? 0 : 24}px;
`;

const SliderWrapper = styled.div`
  display: flex;
  position: relative;
`;

const RangeInputWrapper =styled.div`
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
`;


class EpochSlider extends Component {

  static propTypes = {
    title: PropTypes.string,
    isRanged: PropTypes.bool,
    value0: PropTypes.number,
    value1: PropTypes.number,
    minValue: PropTypes.number,
    maxValue: PropTypes.number,
    sliderHandleWidth: PropTypes.number,
    onSlider0Change: PropTypes.func,
    onInput0Change: PropTypes.func,
    onSlider1Change: PropTypes.func,
    onInput1Change: PropTypes.func,
    onSliderBarChange: PropTypes.func,
    step: PropTypes.number,
    enableBarDrag: PropTypes.bool
  };

  static defaultProps = {
    title: '',
    isRanged: true,
    value0: 0,
    value1: 100,
    minValue: 0,
    maxValue: 100,
    step: 1,
    sliderHandleWidth: 12,
    enableBarDrag: false,
    onSlider0Change: noop,
    onInput0Change: noop,
    onSlider1Change: noop,
    onInput1Change: noop,
    onSliderBarChange: noop,
    disabled: false
  };

  constructor(props) {
    super(props)
    this._updateEpoch = this._updateEpoch.bind(this)
  }

  _updateEpoch (e,v) {
    // console.log('onChange', e.target.value ,v)
    debounce(this.props.setEpoch(e.target.value), 1000)
  }

  render() {
    const {
      classSet,
      isRanged,
      maxValue,
      minValue,
      value1
    } = this.props;
    const value0 = !isRanged && minValue > 0 ? minValue : this.props.value0;
    const currValDelta = value1 - value0;
    const maxDelta = maxValue - minValue;
    const width = currValDelta / maxDelta * 100;

    const v0Left = (value0 - minValue) / maxDelta * 100;
    // + classSet})
    return (
      <div>
        <input type="range" min="0" max="287" value={this.props.currentEpoch} style={sliderStyle} onChange={this._updateEpoch} />
         <Slider
            showValues={false}
            isRanged={true}
            minValue={1}
            maxValue={288}
            value0={value0}
            value1={value1}
            handleWidth={15}
            onSlider0Change={(val0) => console.log(val0)}
            onSlider1Change={(val0) => console.log(val0)}
            onSliderBarChange={(val0, val1) => {
              console.log(val0,val1)
            }}
            enableBarDrag
          />

      </div>
    );
  }
}

const mapDispatchToProps = {
  //setEpoch
}

const mapStateToProps = state => {
  return {
    currentEpoch: state.incidents.currentEpoch
  }
};


export default connect(mapStateToProps, mapDispatchToProps)(EpochSlider)

function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};
