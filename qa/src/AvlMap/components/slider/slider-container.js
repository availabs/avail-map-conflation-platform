import React, {Component} from 'react';
import { connect } from 'react-redux';

// import deepEqual from 'deep-equal'
// import SidebarHeader from './SidebarHeader'
// import SelectedDataPane from './SelectedDataPane'
import EpochSlider from './epochSlider'

 class Sidebar extends Component {
  
  render() {
    let sideBarContainerStyle = {
      width: this.props.isOpen ? '60%' : 0,
      zIndex: 99,
      display: 'flex',
      transition: 'width 250ms',
      position: 'absolute',
      bottom: 0,
      right: 0,
      padding: 20,
      paddingBottom: 30
    }

    let sidebarStyle = {
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
      transition: 'left 250ms, right 250ms',
      alignItems: 'stretch',
      flexGrow: 1
    }

    let sidebarInnerStyle = {
      backgroundColor: '#293145', //#242730
      borderRadius: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }

    let sidebarContentStyle = {
      flexGrow: 1,
      padding: 16,
      overflowY: 'auto',
      overflowX: 'hidden',
      color: '#efefef'
    }
    let minutes = (this.props.currentEpoch % 12) * 5
    minutes = minutes < 10 ? '0'+minutes : minutes

    return (
      <div className='sidebar-container' style={sideBarContainerStyle}>
        <div className='sidebar' style={sidebarStyle}>
          <div className='sidebar-inner' style={sidebarInnerStyle}>
            <div className='sidebar-content' style={sidebarContentStyle}>
              <h5 style={{color: '#efefef'}}>{Math.floor(this.props.currentEpoch/12)}:{ minutes }</h5>
              <EpochSlider />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

Sidebar.defaultProps = {
  isOpen: true
}

const mapDispatchToProps = {}

const mapStateToProps = state => ({
    tmcData: state.graph.tmc || {},
    selectedTMCS: state.incidents.selectedTMCS,
    activeTMCS: state.incidents.activeTMCS,
    currentEpoch: state.incidents.currentEpoch
})

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar)