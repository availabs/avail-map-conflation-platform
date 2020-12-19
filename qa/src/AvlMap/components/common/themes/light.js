import {css} from 'styled-components';

export default {
	backgroundColor: '#f2f4f8',
	highlightColor: '#fafafa',
	textColor: '#3e4b5b',
	subTextColor: 'rgba(0,0,0,0.4)',
	textColorHl: '#456CF9',
	panelBackground: '#fafafa',
	panelBackgroundHover: '#fff',

	transition:'all .4s ease',
	transitionFast:'all .2s ease',
	transitionSlow:'all .8s ease',

	boxShadow:'0 1px 2px 0 rgba(0,0,0,0.10)',
	boxSizing:'border-box',
	borderRadius:'1px',
	borderColor:'#3A414C',
	borderColorLight:'#F1F1F1',

	// TEXT
	labelColor:'#a0a7b4',
	labelHoverColor:'#C6C6C6',
	labelColorLT:'#6A7485',

	textColor:'#A0A7B4',
	textColorLT:'#3A414C',
	titleColorLT:'#29323C',

	subtextColor:'#6A7485',
	subtextColorLT:'#A0A7B4',
	subtextColorActive:'#FFFFFF',

	titleTextColor:'#FFFFFF',
	// textColorHl:'#D3D8E0',
	textColorHlLT:'#F1F1F1',
	activeColor:'#1FBAD6',
	activeColorHover:'#108188',
	errorColor:'#F9042C',

	// Button
	primaryBtnBgd:'#0F9668',
	primaryBtnActBgd:'#13B17B',
	primaryBtnColor:'#FFFFFF',
	primaryBtnActColor:'#FFFFFF',
	primaryBtnBgdHover:'#13B17B',
	primaryBtnRadius:'2px',

	secondaryBtnBgd:'#6A7485',
	secondaryBtnActBgd:'#A0A7B4',
	secondaryBtnColor:'#FFFFFF',
	secondaryBtnActColor:'#FFFFFF',
	secondaryBtnBgdHover:'#A0A7B4',

	linkBtnBgd:'transparent',
	//linkBtnActBgd:linkBtnBgd,
	linkBtnColor:'#A0A7B4',
	linkBtnActColor:'#3A414C',
	//linkBtnActBgdHover:linkBtnBgd,

	//negativeBtnBgd:errorColor,
	negativeBtnActBgd:'#FF193E',
	negativeBtnBgdHover:'#FF193E',
	negativeBtnColor:'#FFFFFF',
	negativeBtnActColor:'#FFFFFF',

	// Input
	inputBoxHeight:'34px',
	inputPadding:'4px 10px',
	inputFontSize:'11px',
	inputFontWeight:500,
	inputBgd:'#29323C',
	inputBgdHover:'#3A414C',
	inputBgdActive:'#3A414C',
	inputBorderColor:'#29323C',
	inputBorderHoverColor:'#3A414C',
	inputBorderActiveColor:'#65affd',
	inputColor:'#A0A7B4',
	inputBorderRadius:'1px',
	inputPlaceholderColor:'#6A7485',
	inputPlaceholderFontWeight:400,

	secondaryInputHeight:'28px',
	secondaryInputBgd:'#242730',
	secondaryInputBgdHover:'#3A414C',
	secondaryInputBgdActive:'#3A414C',
	secondaryInputColor:'#A0A7B4',
	secondaryInputBorderColor:'#242730',
	secondaryInputBorderActiveColor:'#D3D8E0',

	// Select
	//selectColor:inputColor,
	//selectColorLT:titleColorLT,

	selectActiveBorderColor:'#D3D8E0',
	selectFontSize:'11px',
	selectFontWeight:'400',
	selectFontWeightBold:'500',

	selectColorPlaceHolder:'#6A7485',
	//selectBackground:inputBgd,
	//selectBackgroundHover:inputBgdHover,
	selectBackgroundLT:'#FFFFFF',
	selectBackgroundHoverLT:'#F8F8F9',
	selectBorderColor:'#D3D8E0',
	selectBorderColorLT:'#D3D8E0',
	selectBorderRadius:'1px',
	selectBorder:0,

	dropdownListHighlightBg:'#6A7485',
	dropdownListShadow:'0 6px 12px 0 rgba(0,0,0,0.16)',
	dropdownListBgd:'#3A414C',
	dropdownListBorderTop:'#242730',

	// Switch
	switchWidth:24,
	switchHeight:12,
	switchLabelMargin:12,

	switchTrackBgd:'#29323C',
	//switchTrackBgdActive:activeColor,
	switchTrackBorderRadius:'1px',
	switchBtnBgd:'#6A7485',
	switchBtnBgdActive:'#D3D8E0',
	switchBtnBoxShadow:'0 2px 4px 0 rgba(0,0,0,0.40)',
	switchBtnBorderRadius:'1px',
	switchBtnWidth:'12px',
	switchBtnHeight:'12px',

	secondarySwitchTrackBgd:'#242730',
	secondarySwitchBtnBgd:'#3A414C',

	// Checkbox
	checkboxWidth:16,
	checkboxHeight:16,
	checkboxMargin:12,
	//checkboxBorderColor:selectBorderColor,
	checkboxBorderRadius:'2px',
	//checkboxBorderColorLT:selectBorderColorLT,
	checkboxBoxBgd:'white',
	//checkboxBoxBgdChecked:primaryBtnBgd,

	// Side Panel
	sidePanelHeaderBg:'#29323C',
	sidePanelBg:'#242730',
	//sideBarCloseBtnBgd:secondaryBtnBgd,
	sideBarCloseBtnColor:'#29323C',
	//sideBarCloseBtnBgdHover:secondaryBtnActBgd,

	// panelBackground:'#29323C',
	// panelBackgroundHover:'#3A4552',
	panelActiveBg:'#3A4552',
	panelActiveBgLT:'#6A7485',
	panelHeaderIcon:'#6A7485',
	panelHeaderIconActive:'#A0A7B4',
	panelHeaderHeight:48,
	panelBoxShadow:'0 6px 12px 0 rgba(0,0,0,0.16)',
	panelBorderRadius:'2px',
	panelBackgroundLT:'#f8f8f9',

	panelBorderColor:'#3A414C',
	//panelBorder:`1px solid ${borderColor}`,
	//panelBorderLT:`1px solid ${borderColorLight}`,

	mapPanelBackgroundColor:'#242730',
	mapPanelHeaderBackgroundColor:'#29323C',
	tooltipBg:'#F8F8F9',
	tooltipColor:'#333334',

	// Modal
	modalTitleColor:'#3A414C',
	modalTitleFontSize:'24px',
	modalFooterBgd:'#F8F8F9',
	modalImagePlaceHolder:'#DDDFE3',

	// Modal Dialog (Dark)
	modalDialogBgd:'#3A414C',
	//modalDialogColor:textColorHl,

	// Slider
	sliderBarColor:'#6A7485',
	sliderBarBgd:'#3A414C',
	sliderBarHoverColor:'#D3D8E0',
	sliderBarRadius:'1px',
	sliderBarHeight:'4px',
	sliderHandleHeight:'12px',
	sliderHandleWidth:'12px',
	sliderHandleColor:'#D3D8E0',
	sliderHandleHoverColor:'#FFFFFF',
	sliderHandleShadow:'0 2px 4px 0 rgba(0,0,0,0.40)',

	// Plot
	rangeBrushBgd:'#3A414C'	
}