import React from 'react';
// import PropTypes from 'prop-types';
import classnames from 'classnames';
import styled from 'styled-components';
import PanelHeaderAction from './panelHeaderAction';
import {
  EyeSeen,
  EyeUnseen,
  VertDots,
  ArrowDown,
  Trash,
  Clock
} from '../common/icons';


import {
    //InlineInput,
    StyledPanelHeader,
    Tooltip
} from '../common/styled-components';

const defaultProps = {
  isDragNDropEnabled: true,
  showRemoveLayer: true,
  className: '',
  idx: 1,
  // isConfigActive: false ,
  isVisible: true,
  layerId: 1,
  layerType: '',
  labelRCGColorValues: [255, 0, 0],
  isConfigActive: true,
  onToggleVisibility: () => {},
  onUpdateLayerLabel: () => {},
  onToggleEnableConfig: () => {},
  onRemoveLayer: () => {}
};

const StyledLayerPanelHeader = styled(StyledPanelHeader)`
  .layer__remove-layer {
    opacity: 0;
  }
  width: 100%;
  :hover {
    cursor: pointer;
    background-color: ${props => props.theme.panelBackgroundHover};

    .layer__drag-handle {
      opacity: 1;
    }

    .layer__remove-layer {
      opacity: 1;
    }

    .layer__enable-config {
      color: white
    }
  }
`;

const HeaderLabelSection = styled.div`
  display: flex;
  color: ${props => props.theme.textColor};
`;

const HeaderActionSection = styled.div`
  display: flex;
`;

const LayerTitleSection = styled.div`
  margin-left: 12px;
  .layer__title__type {
    color: ${props => props.theme.subtextColor};
    font-size: 10px;
    line-height: 12px;
    letter-spacing: 0.37px;
    text-transform: capitalize;
  }
`;

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  opacity: 0;

  :hover {
    cursor: move;
    color: ${props => props.theme.textColorHl};
  }
`;

const ActionBarContainer = styled.div`
  display: flex;
`
const IconWrapper = styled.div`
  color: ${ props => props.theme.textColor };
  display: inline-flex;
  margin-left: 5px;
  transition: color 0.15s;
  :hover {
    color: ${ props => props.theme.textColorHl };
  }
`

const ActionBar = ({ layer, actions, actionMap }) =>
  <ActionBarContainer>
    {
      actions.map((a, i) =>
        <IconWrapper key={ i }>
          <div data-tip
            data-for={ `action-bar-${ i }` }
            onClick={ e => {
              e.stopPropagation();
              typeof a.action === "function" ?
                a.action.call(layer) :
                actionMap[a.action[0]](layer.name, ...a.action.slice(1))
            } }>
            <a.Icon />
          </div>
          <Tooltip
            id={ `action-bar-${ i }` }
            effect="solid"
            delayShow={ 500 }>
            <span>{ a.tooltip }</span>
          </Tooltip>
        </IconWrapper>
      )
    }
  </ActionBarContainer>

class RemoveIcon extends React.Component {
  render() {
    return (
      <div { ...this.props }><span className="fa fa-close"/></div>
    )
  }
}

const LayerPanelHeader = ({
  className,
  isConfigActive,
  isDragNDropEnabled,
  isVisible,
  label,
  layerType,
  layer,
  labelRCGColorValues,
  onToggleVisibility,
  onUpdateLayerLabel,
  onToggleEnableConfig,
  onRemoveLayer,
  deleteDynamicLayer,
  showRemoveLayer,
  actionMap
}) => (
  <StyledLayerPanelHeader
    className={classnames('layer-panel__header', {
      'sort--handle': !isConfigActive
    })}
    style={ layer.actions ? { height: "32px" } : null }
    active={isConfigActive}
    labelRCGColorValues={labelRCGColorValues}
    onClick={onToggleEnableConfig}
  >
    <HeaderLabelSection className="layer-panel__header__content">
      {isDragNDropEnabled && (
        <DragHandle className="layer__drag-handle">
          <VertDots height="20px" />
        </DragHandle>
      )}
      <PanelHeaderAction
        className="layer__visibility-toggle"
        id={layer.name}
        tooltip={isVisible ? 'hide layer' : 'show layer'}
        onClick={onToggleVisibility}
        IconComponent={isVisible ? EyeSeen : EyeUnseen}
        active={isVisible}
        flush
      />
      <LayerTitleSection className="layer__title">
        <div>
          <div style={ { lineHeight: layer.actions ? "16px" : "26px" } }>{ layer.name }</div>
          { !layer.actions ? null :
            <div style={ { lineHeight: "16px" } }>
              <ActionBar actionMap={ actionMap }
                actions={ layer.actions }
                layer={ layer }/>
            </div>
          }
        </div>
      </LayerTitleSection>
      { layer.loading ?
        <PanelHeaderAction
          className="layer__loading-layer"
          id={layer.name}
          tooltip={'Layer Loading'}
          onClick={null}
          tooltipType="error"
          IconComponent={Clock}

        />
        : null
      }
    </HeaderLabelSection>
    <HeaderActionSection className="layer-panel__header__actions">
      {showRemoveLayer ? (
        <PanelHeaderAction
          className="layer__remove-layer"
          id={layer.name}
          tooltip={'Remove layer'}
          onClick={onRemoveLayer}
          tooltipType="error"
          IconComponent={ RemoveIcon }

        />
      ) : null}
      { !layer._isDynamic ? null :
        <PanelHeaderAction
          className="layer__remove-layer"
          id={layer.name}
          tooltip={'Delete Dyanmic Layer'}
          onClick={ deleteDynamicLayer }
          tooltipType="error"
          IconComponent={ Trash }/>
      }
      <PanelHeaderAction
        className="layer__enable-config"
        id={layer.name}
        tooltip={'Layer settings'}
        onClick={onToggleEnableConfig}
        IconComponent={ ArrowDown }

      />
    </HeaderActionSection>
  </StyledLayerPanelHeader>
);

LayerPanelHeader.defaultProps = defaultProps;

export default LayerPanelHeader
