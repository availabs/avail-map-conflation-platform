// Copyright (c) 2018 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { css } from 'styled-components';
import { DIMENSIONS } from 'constants/default-settings';

const createShade = (color, shift) => {
  const r = parseInt(color.slice(1, 3), 16),
    g = parseInt(color.slice(3, 5), 16),
    b = parseInt(color.slice(5, 7), 16);

  return "#" + ("0" + (Math.min(Math.max(0, r + 32 * shift), 255)).toString(16)).slice(-2)
    + ("0" + (Math.min(Math.max(0, g + 32 * shift), 255)).toString(16)).slice(-2)
    + ("0" + (Math.min(Math.max(0, b + 32 * shift), 255)).toString(16)).slice(-2);
}

const BASE_LIGHT_COLOR = '#efefef';
const LIGHTER_1 = createShade(BASE_LIGHT_COLOR, 0.5);
const DARKER_1 = createShade(BASE_LIGHT_COLOR, -0.5);
const DARKER_2 = createShade(BASE_LIGHT_COLOR, -1);
const DARKER_3 = createShade(BASE_LIGHT_COLOR, -1.5);
const DARKER_4 = createShade(BASE_LIGHT_COLOR, -2);
const DARKER_5 = createShade(BASE_LIGHT_COLOR, -3);

const BASE_TEXT_COLOR = '#404040';

export const transition = 'all .4s ease';
export const transitionFast = 'all .2s ease';
export const transitionSlow = 'all .8s ease';

export const boxShadow = '0 1px 2px 0 rgba(0,0,0,0.10)';
export const boxSizing = 'border-box';
export const borderRadius = '1px';
export const borderColor = DARKER_2;
export const borderColorLight = '#F1F1F1';

// TEXT
export const labelColor = createShade(BASE_TEXT_COLOR, 2);
export const labelHoverColor = '#C6C6C6';
export const labelColorLT = createShade(BASE_TEXT_COLOR, 2);

export const subtextColor = BASE_TEXT_COLOR;
export const subtextColorLT = createShade(BASE_TEXT_COLOR, 1);
export const subtextColorActive = createShade(BASE_TEXT_COLOR, 1);
//["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"]
export const textColor = BASE_TEXT_COLOR;
export const textColorLT = createShade(BASE_TEXT_COLOR, 1);
export const titleColorLT = createShade(BASE_TEXT_COLOR, 1);

export const titleTextColor = BASE_TEXT_COLOR;
export const textColorHl = createShade(BASE_TEXT_COLOR, -3);
export const textColorHlLT = createShade(BASE_TEXT_COLOR, -2);

export const activeColor = '#2171b5';
export const activeColorHover = '#4292c6';
export const errorColor = '#aa0000';

// Button
export const primaryBtnBgd = '#0F9668';
export const primaryBtnActBgd = '#13B17B';
export const primaryBtnColor = '#FFFFFF';
export const primaryBtnActColor = '#FFFFFF';
export const primaryBtnBgdHover = '#13B17B';
export const primaryBtnDisabled = createShade(primaryBtnBgd, -1);
export const primaryBtnRadius = '2px';

export const secondaryBtnBgd = '#6A7485';
export const secondaryBtnActBgd = '#A0A7B4';
export const secondaryBtnColor = '#FFFFFF';
export const secondaryBtnActColor = '#FFFFFF';
export const secondaryBtnBgdHover = '#A0A7B4';

export const darkBtnBgd = "#666666";
export const darkBtnActBgd = createShade(darkBtnBgd, 1);
export const darkBtnColor = '#FFFFFF';
export const darkBtnActColor = '#FFFFFF';
export const darkBtnBgdHover = createShade(darkBtnBgd, 1);
export const darkBtnDisabled = createShade(darkBtnBgd, -1);

export const linkBtnBgd = 'transparent';
export const linkBtnActBgd = linkBtnBgd;
export const linkBtnColor = '#A0A7B4';
export const linkBtnActColor = DARKER_2;
export const linkBtnActBgdHover = linkBtnBgd;

export const negativeBtnBgd = errorColor;
export const negativeBtnActBgd = '#FF193E';
export const negativeBtnBgdHover = '#FF193E';
export const negativeBtnColor = '#FFFFFF';
export const negativeBtnActColor = '#FFFFFF';

// Input
export const inputBoxHeight = '34px';
export const inputPadding = '4px 10px';
export const inputFontSize = '11px';
export const inputFontWeight = 500;
export const inputBgd = DARKER_1;
export const inputBgdHover = DARKER_2;
export const inputBgdActive = DARKER_2;
export const inputBorderColor = DARKER_3;
export const inputBorderHoverColor = DARKER_5;
export const inputBorderActiveColor = DARKER_4;
export const inputColor = BASE_TEXT_COLOR;
export const inputBorderRadius = '1px';
export const inputPlaceholderColor = createShade(BASE_TEXT_COLOR, 2);
export const inputPlaceholderFontWeight = 400;

export const secondaryInputHeight = '28px';
export const secondaryInputBgd = BASE_LIGHT_COLOR;
export const secondaryInputBgdHover = DARKER_2;
export const secondaryInputBgdActive = DARKER_2;
export const secondaryInputColor = BASE_TEXT_COLOR;
export const secondaryInputBorderColor = DARKER_3;
export const secondaryInputBorderActiveColor = DARKER_4;

// Select
export const selectColor = inputColor;
export const selectColorLT = titleColorLT;

export const selectActiveBorderColor = '#D3D8E0';
export const selectFontSize = '11px';
export const selectFontWeight = '400';
export const selectFontWeightBold = '500';

export const selectColorPlaceHolder = createShade(BASE_TEXT_COLOR, 2);
export const selectBackground = inputBgd;
export const selectBackgroundHover = inputBgdHover;
export const selectBackgroundLT = LIGHTER_1;
export const selectBackgroundHoverLT = createShade(LIGHTER_1, -0.5);
export const selectBorderColor = '#D3D8E0';
export const selectBorderColorLT = '#D3D8E0';
export const selectBorderRadius = '1px';
export const selectBorder = 0;

export const dropdownListHighlightBg = createShade(DARKER_2, -0.5);
export const dropdownListShadow = '0 6px 12px 0 rgba(0,0,0,0.16)';
export const dropdownListBgd = DARKER_2;
export const dropdownListBorderTop = DARKER_2;

// Switch
export const switchWidth = 24;
export const switchHeight = 12;
export const switchLabelMargin = 12;

export const switchTrackBgd = DARKER_1;
export const switchTrackBgdActive = activeColor;
export const switchTrackBorderRadius = '1px';
export const switchBtnBgd = createShade(BASE_TEXT_COLOR, 2);
export const switchBtnBgdActive = '#D3D8E0';
export const switchBtnBoxShadow = '0 2px 4px 0 rgba(0,0,0,0.40)';
export const switchBtnBorderRadius = '1px';
export const switchBtnWidth = '12px';
export const switchBtnHeight = '12px';

export const secondarySwitchTrackBgd = BASE_LIGHT_COLOR;
export const secondarySwitchBtnBgd = DARKER_2;

// Checkbox
export const checkboxWidth = 16;
export const checkboxHeight = 16;
export const checkboxMargin = 12;
export const checkboxBorderColor = selectBorderColor;
export const checkboxBorderRadius = '2px';
export const checkboxBorderColorLT = selectBorderColorLT;
export const checkboxBoxBgd = 'white';
export const checkboxBoxBgdChecked = primaryBtnBgd;

// Side Panel
export const sidePanelHeaderBg = DARKER_1;
export const sidePanelBg = BASE_LIGHT_COLOR;
export const sideBarCloseBtnBgd = secondaryBtnBgd;
export const sideBarCloseBtnColor = DARKER_1;
export const sideBarCloseBtnBgdHover = secondaryBtnActBgd;

export const panelBackground = DARKER_1;
export const panelBackgroundHover = DARKER_2;
export const panelActiveBg = DARKER_2;
export const panelActiveBgLT = createShade(BASE_TEXT_COLOR, 2);
export const panelHeaderIcon = createShade(BASE_TEXT_COLOR, 2);
export const panelHeaderIconActive = '#A0A7B4';
export const panelHeaderHeight = 38;
export const panelBoxShadow = '0 6px 12px 0 rgba(0,0,0,0.16)';
export const panelBorderRadius = '2px';
export const panelBackgroundLT = '#f8f8f9';

export const panelBorderColor = DARKER_2;
export const panelBorder = `1px solid ${borderColor}`;
export const panelBorderLT = `1px solid ${borderColorLight}`;

export const mapPanelBackgroundColor = BASE_LIGHT_COLOR;
export const mapPanelHeaderBackgroundColor = DARKER_1;
export const tooltipBg = '#F8F8F9';
export const tooltipColor = '#333334';

// Modal
export const modalTitleColor = DARKER_2;
export const modalTitleFontSize = '24px';
export const modalFooterBgd = '#F8F8F9';
export const modalImagePlaceHolder = '#DDDFE3';

// Modal Dialog (Dark)
export const modalDialogBgd = DARKER_2;
export const modalDialogColor = textColorHl;

// Slider
export const sliderBarColor = createShade(BASE_TEXT_COLOR, 2);
export const sliderBarBgd = DARKER_2;
export const sliderBarHoverColor = '#D3D8E0';
export const sliderBarRadius = '1px';
export const sliderBarHeight = '4px';
export const sliderHandleHeight = '12px';
export const sliderHandleWidth = '12px';
export const sliderHandleColor = '#D3D8E0';
export const sliderHandleHoverColor = '#FFFFFF';
export const sliderHandleShadow = '0 2px 4px 0 rgba(0,0,0,0.40)';

// Plot
export const rangeBrushBgd = DARKER_2;

export const textTruncate = {
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  wordWrap: 'normal'
};

// theme is passed to kepler.gl when it's mounted,
// it is used by styled-components to pass along to
// all child components

const input = css`
  align-items: center;
  background-color: ${props => props.theme.inputBgd};
  border: 1px solid
    ${props =>
      props.active
        ? props.theme.inputBorderActiveColor
        : props.error ? props.theme.errorColor : props.theme.inputBgd};
  border-radius: 2px;
  caret-color: ${props => props.theme.inputBorderActiveColor};
  color: ${props => props.theme.inputColor};
  display: flex;
  font-size: ${props => props.theme.inputFontSize};
  font-weight: ${props => props.theme.inputFontWeight};
  height: ${props => props.theme.inputBoxHeight};
  justify-content: space-between;
  outline: none;
  overflow: hidden;
  padding: ${props => props.theme.inputPadding};
  text-overflow: ellipsis;
  transition: ${props => props.theme.transition};
  white-space: nowrap;
  width: 100%;
  word-wrap: normal;
  pointer-events: ${props => (props.disabled ? 'none' : 'all')};
  opacity: ${props => (props.disabled ? 0.5 : 1)};

  :hover {
    cursor: ${props => props.type === 'number' ? 'text' : 'pointer'};
    background-color: ${props =>
      props.active ? props.theme.inputBgdActive : props.theme.inputBgdHover};
    border-color: ${props =>
      props.active
        ? props.theme.inputBorderActiveColor
        : props.theme.inputBorderHoverColor};
  }

  :active,
  :focus,
  &.focus,
  &.active {
    background-color: ${props => props.theme.inputBgdActive};
    border-color: ${props => props.theme.inputBorderActiveColor};
  }

  ::placeholder {
    color: ${props => props.theme.inputPlaceholderColor};
    font-weight: ${props => props.theme.inputPlaceholderFontWeight};
  }

  /* Disable Arrows on Number Inputs */
  ::-webkit-inner-spin-button,
  ::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const inputLT = css`
  ${input}

  background-color: ${props => props.theme.selectBackgroundLT};
  border: 1px solid
  ${props =>
    props.active
      ? props.theme.selectActiveBorderColor
      : props.error
      ? props.theme.errorColor
      : props.theme.selectBorderColorLT};
  color: ${props => props.theme.selectColorLT};
  caret-color: ${props => props.theme.selectColorLT};

  ::-webkit-input-placeholder {
    color: ${props => props.theme.subtextColorLT};
    font-weight: 400;
  }

  :active,
  :focus,
  &.focus,
  &.active {
    background-color: ${props => props.theme.selectBackgroundLT};
    border-color: ${props => props.theme.textColorLT};
  }

  :hover {
    background-color: ${props => props.theme.selectBackgroundLT};
    cursor: ${props => ['number', 'text'].includes(props.type) ? 'text' : 'pointer'};
    border-color: ${props =>
    props.active
      ? props.theme.textColorLT
      : props.theme.subtextColor};
  }
`;

const secondaryInput = css`
  ${props => props.theme.input}
  color: ${props => props.theme.secondaryInputColor};
  background-color: ${props => props.theme.secondaryInputBgd};
  height: ${props => props.theme.secondaryInputHeight};
  border: 1px solid
    ${props => props.error
          ? props.theme.errorColor
          : props.theme.secondaryInputBorderColor};

  :hover {
    cursor: pointer;
    background-color: ${props => props.theme.secondaryInputBgdHover};
    border-color: ${props => props.theme.secondaryInputBgdHover};
  }

  :active,
  &.active {
    background-color: ${props => props.theme.secondaryInputBgdActive};
    border-color: ${props => props.theme.secondaryInputBorderActiveColor};
  }
`;

const chickletedInput = css`
  ${props => props.theme.secondaryInput}
  cursor: pointer;
  flex-wrap: wrap;
  height: auto;
  justify-content: start;
  margin-bottom: 2px;
  padding: 4px 10px;
  white-space: normal;
  
  background-color: transparent;
  font: Arial;
  font-size: inherit;
  font-weight: inherit;
  border: 2px solid #dde2ec;
  border-radius: 2px;
`;

const inlineInput = css`
  ${props => props.theme.input} color: ${props => props.theme.textColor};
  font-size: 13px;
  letter-spacing: 0.43px;
  line-height: 18px;
  height: 24px;
  font-weight: 400;
  padding-left: 4px;
  margin-left: -4px;
  background-color: transparent;
  border: 1px solid transparent;

  :hover {
    height: 24px;
    cursor: text;
    background-color: transparent;
    border: 1px solid ${props => props.theme.labelColor};
  }

  :active,
  .active,
  :focus {
    background-color: transparent;
    border: 1px solid ${props => props.theme.inputBorderActiveColor};
  }
`;

const switchTrack = css`
  background: ${props =>
    props.checked
      ? props.theme.switchTrackBgdActive
      : props.theme.switchTrackBgd};
  position: absolute;
  top: 0;
  left: ${props => -props.theme.switchLabelMargin}px;
  content: '';
  display: block;
  width: ${props => props.theme.switchWidth}px;
  height: ${props => props.theme.switchHeight}px;
  border-radius: ${props => props.theme.switchTrackBorderRadius};
`;

const switchButton = css`
  transition: ${props => props.theme.transition};
  position: absolute;
  top: 0;
  left: ${props => (props.checked ? props.theme.switchWidth / 2 : -1) - props.theme.switchLabelMargin}px;
  content: '';
  display: block;
  height: ${props => props.theme.switchBtnHeight};
  width: ${props => props.theme.switchBtnWidth};
  background: ${props => props.checked ?
  props.theme.switchBtnBgdActive : props.theme.switchBtnBgd};
  box-shadow: ${props => props.theme.switchBtnBoxShadow};
`;

const inputSwitch = css`
  user-select: none;
  cursor: pointer;
  line-height: 0;
  font-weight: 500;
  font-size: 12px;
  color: ${props => props.theme.labelColor};
  position: relative;
  display: inline-block;
  padding-top: ${props => props.theme.switchHeight / 2}px;
  padding-right: 0;
  padding-bottom: 0;
  padding-left: ${props => props.theme.switchWidth}px;

  :before {
    ${props => props.theme.switchTrack};
  }

  :after {
    ${props => props.theme.switchButton};
  }
`;

// This is a light version checkbox
const checkboxBox = css`
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  width: ${props => props.theme.checkboxWidth}px;
  height: ${props => props.theme.checkboxHeight}px;
  background: ${props => props.checked ? props.theme.checkboxBoxBgdChecked : props.theme.checkboxBoxBgd};
  border: 1px solid ${props => props.checked ? props.theme.checkboxBoxBgdChecked : props.theme.checkboxBorderColor};
  border-radius: 2px;
  content: '';
`;

const checkboxCheck = css`
  width: 10px;
  height: 5px;
  border-bottom: 2px solid white;
  border-left: 2px solid white;
  top: 4px;
  left: 3px;
  transform: rotate(-45deg);
  display: block;
  position: absolute;
  opacity: ${props => props.checked ? 1 : 0};
  content: "";
`;

const inputCheckbox = css`
  display: inline-block;
  position: relative;
  padding-left: 32px;
  margin-bottom: 24px;
  line-height: 20px;
  vertical-align: middle;
  cursor: pointer;
  font-size: 12px;
  color: ${props => props.theme.labelColor};
  margin-left: -${props => props.theme.switchLabelMargin}px;

  :before {
     ${props => props.theme.checkboxBox};
  }

  :after {
    ${props => props.theme.checkboxCheck};
  }
`;

const secondarySwitch = css`
  ${props => props.theme.inputSwitch}
  :before {
    ${props => props.theme.switchTrack} background: ${props =>
        props.checked
          ? props.theme.switchTrackBgdActive
          : props.theme.secondarySwitchTrackBgd};
  }

  :after {
    ${props => props.theme.switchButton}
    background: ${props => props.checked
          ? props.theme.switchBtnBgdActive
          : props.theme.secondarySwitchBtnBgd};
  }
`;

const dropdownScrollBar = css`
  ::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }

  ::-webkit-scrollbar-corner {
    background: ${props => props.theme.dropdownListBgd};
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.dropdownListBgd};
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: ${props => props.theme.labelColor};
    border: 3px solid ${props => props.theme.dropdownListBgd};
  };

  :vertical:hover {
    background: ${props => props.theme.textColorHl};
    cursor: pointer;
  }
}`;

const dropdownListAnchor = css`
  color: ${props => props.theme.selectColor};
  padding-left: 3px;
`;

const dropdownListItem = css`
  font-size: 11px;
  padding: 3px 9px;
  font-weight: 500;

  &.hover,
  &:hover {
    cursor: pointer;
    background-color: ${props => props.theme.dropdownListHighlightBg};

    .list__item__anchor {
      color: ${props => props.theme.textColorHl};
    }
  }
`;

const dropdownListHeader = css`
  font-size: 11px;
  padding: 5px 9px;
  color: ${props => props.theme.labelColor};
`;

const dropdownListSection = css`
  padding: 0 0 4px 0;
  margin-bottom: 4px;
  border-bottom: 1px solid ${props => props.theme.labelColor};
`;

const dropdownList = css`
  overflow-y: auto;
  max-height: 280px;
  box-shadow: ${props => props.theme.dropdownListShadow};
  border-radius: 2px;

  .list__section {
    ${props => props.theme.dropdownListSection};
  }
  .list__header {
    ${props => props.theme.dropdownListHeader};
  }

  .list__item {
    ${props => props.theme.dropdownListItem};
  }

  .list__item__anchor {
    ${props => props.theme.dropdownListAnchor};
  }

  ${props => props.theme.dropdownScrollBar};
`;

const sidePanelScrollBar = css`
  ::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }

  ::-webkit-scrollbar-corner {
    background: ${props => props.theme.sidePanelBg};
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.sidePanelBg};
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: ${props => props.theme.panelBackgroundHover};
    border: 3px solid ${props => props.theme.sidePanelBg};

    :hover {
      background: ${props => props.theme.labelColor};
      cursor: pointer;
    }
  };
}`;

const panelDropdownScrollBar = css`
  ::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }

  ::-webkit-scrollbar-corner {
    background: ${props => props.theme.panelBackground};
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.panelBackground};
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: ${props => props.theme.panelBackgroundHover};
    border: 3px solid ${props => props.theme.panelBackground};
    :hover {
      background: ${props => props.theme.labelColor};
      cursor: pointer;
    }
  };
`;

const scrollBar = css`
  ::-webkit-scrollbar {
    height: 10px;
    width: 10px;
  }

  ::-webkit-scrollbar-corner {
    background: ${props => props.theme.panelBackground};
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.panelBackground};
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: ${props => props.theme.labelColor};
    border: 3px solid ${props => props.theme.panelBackground}

    :vertical:hover {
      background: ${props => props.theme.textColorHl};
      cursor: pointer;
    }

    :horizontal:hover {
      background: ${props => props.theme.textColorHl};
      cursor: pointer;
    }
  }
}`;

export const modalScrollBar = css`
  ::-webkit-scrollbar {
    width: 14px;
    height: 16px;
  }

  ::-webkit-scrollbar-track {
    background: white;
  }
  ::-webkit-scrollbar-track:horizontal {
    background: ${props => props.theme.textColorHl};
  }
  ::-webkit-scrollbar-thumb {
    background: ${props => props.theme.labelColorLT};
    border: 4px solid white;
  }

  ::-webkit-scrollbar-corner {
    background: ${props => props.theme.textColorHl};
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #969da9;
  }

  ::-webkit-scrollbar-thumb:vertical {
    border-radius: 7px;
  }

  ::-webkit-scrollbar-thumb:horizontal {
    border-radius: 9px;
    border: 4px solid ${props => props.theme.textColorHl};
  }
`;

const theme = {
  ...DIMENSIONS,
  // templates
  // backgroundColor,
  // highlightColor,
  input,
  inputLT,
  inlineInput,
  chickletedInput,
  secondaryInput,
  dropdownScrollBar,
  dropdownList,
  dropdownListItem,
  dropdownListAnchor,
  dropdownListHeader,
  dropdownListSection,
  dropdownListShadow,
  modalScrollBar,
  scrollBar,
  sidePanelScrollBar,
  inputSwitch,
  secondarySwitch,
  switchTrack,
  switchButton,
  inputCheckbox,
  checkboxBox,
  checkboxCheck,

  // Transitions
  transition,
  transitionFast,
  transitionSlow,

  // styles
  activeColor,
  activeColorHover,
  borderRadius,
  boxShadow,
  errorColor,
  dropdownListHighlightBg,
  dropdownListBgd,
  dropdownListBorderTop,

  labelColor,
  labelColorLT,
  labelHoverColor,
  mapPanelBackgroundColor,
  mapPanelHeaderBackgroundColor,

  // Select
  selectActiveBorderColor,
  selectBackground,
  selectBackgroundLT,
  selectBackgroundHover,
  selectBackgroundHoverLT,
  selectBorder,
  selectBorderColor,
  selectBorderRadius,
  selectBorderColorLT,
  selectColor,
  selectColorPlaceHolder,
  selectFontSize,
  selectFontWeight,
  selectColorLT,

  // Input
  inputBgd,
  inputBgdHover,
  inputBgdActive,
  inputBoxHeight,
  inputBorderColor,
  inputBorderActiveColor,
  inputBorderHoverColor,
  inputBorderRadius,
  inputColor,
  inputPadding,
  inputFontSize,
  inputFontWeight,
  inputPlaceholderColor,
  inputPlaceholderFontWeight,

  secondaryInputBgd,
  secondaryInputBgdHover,
  secondaryInputBgdActive,
  secondaryInputHeight,
  secondaryInputColor,
  secondaryInputBorderColor,
  secondaryInputBorderActiveColor,

  // Switch
  switchWidth,
  switchHeight,
  switchTrackBgd,
  switchTrackBgdActive,
  switchTrackBorderRadius,
  switchBtnBgd,
  switchBtnBgdActive,
  switchBtnBoxShadow,
  switchBtnBorderRadius,
  switchBtnWidth,
  switchBtnHeight,
  switchLabelMargin,

  secondarySwitchTrackBgd,
  secondarySwitchBtnBgd,

  // Checkbox
  checkboxWidth,
  checkboxHeight,
  checkboxMargin,
  checkboxBorderColor,
  checkboxBorderRadius,
  checkboxBorderColorLT,
  checkboxBoxBgd,
  checkboxBoxBgdChecked,

  // Button
  primaryBtnBgd,
  primaryBtnDisabled,
  primaryBtnActBgd,
  primaryBtnColor,
  primaryBtnActColor,
  primaryBtnBgdHover,
  primaryBtnRadius,
  secondaryBtnBgd,
  secondaryBtnActBgd,
  secondaryBtnBgdHover,
  secondaryBtnColor,
  secondaryBtnActColor,

  darkBtnBgd,
  darkBtnActBgd,
  darkBtnColor,
  darkBtnActColor,
  darkBtnBgdHover,
  darkBtnDisabled,

  negativeBtnBgd,
  negativeBtnActBgd,
  negativeBtnBgdHover,
  negativeBtnColor,
  negativeBtnActColor,

  linkBtnBgd,
  linkBtnActBgd,
  linkBtnColor,
  linkBtnActColor,
  linkBtnActBgdHover,

  // Modal
  modalTitleColor,
  modalTitleFontSize,
  modalFooterBgd,
  modalImagePlaceHolder,

  modalDialogBgd,
  modalDialogColor,

  // Side Panel
  sidePanelBg,

  sideBarCloseBtnBgd,
  sideBarCloseBtnColor,
  sideBarCloseBtnBgdHover,
  sidePanelHeaderBg,

  // Side Panel Panel
  panelActiveBg,
  panelBackground,
  panelBackgroundHover,
  panelBackgroundLT,
  panelBoxShadow,
  panelBorderRadius,
  panelBorder,
  panelBorderColor,
  panelBorderLT,
  panelHeaderIcon,
  panelHeaderIconActive,
  panelHeaderHeight,
  panelDropdownScrollBar,

  // TextComponent
  textColor,
  textColorLT,
  textColorHl,
  titleTextColor,
  subtextColor,
  subtextColorLT,
  subtextColorActive,
  textTruncate,
  titleColorLT,
  tooltipBg,
  tooltipColor,

  // Slider
  sliderBarColor,
  sliderBarBgd,
  sliderBarHoverColor,
  sliderBarRadius,
  sliderBarHeight,
  sliderHandleHeight,
  sliderHandleWidth,
  sliderHandleColor,
  sliderHandleHoverColor,
  sliderHandleShadow,

  // Plot
  rangeBrushBgd
};

export default theme;

export const themeLT = {
  ...theme,

  // template
  input: inputLT,
  panelActiveBg: panelActiveBgLT,
  textColor: textColorLT,
  textColorHl: textColorHlLT
};
