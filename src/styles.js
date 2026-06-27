export const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: '#282828',
  color: '#ccc',
  fontFamily: 'Segoe UI, sans-serif',
  fontSize: '11px'
};

export const topBarStyle = {
  height: '35px',
  background: '#3c3c3c',
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  borderBottom: '1px solid #282828',
  gap: '12px'
};

export const sidebarStyle = {
  width: '35px',
  background: '#333',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '5px 0',
  borderRight: '1px solid #282828',
  gap: '5px'
};

export const workspaceStyle = {
  flex: 1,
  background: '#1e1e1e',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'auto',
  position: 'relative'
};

export const rightPanelStyle = {
  width: '200px',
  background: '#333',
  borderLeft: '1px solid #282828',
  display: 'flex',
  flexDirection: 'column'
};

export const swatchGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: '5px',
  padding: '10px'
};

export const panelHeader = {
  background: '#3c3c3c',
  padding: '5px 10px',
  fontSize: '10px',
  fontWeight: 'bold',
  borderBottom: '1px solid #282828',
  borderTop: '1px solid #282828'
};

export const labelStyle = {
  fontSize: '9px',
  fontWeight: 'bold',
  color: '#888',
  marginRight: '5px'
};

export const toolBtnStyle = {
  background: '#444',
  border: 'none',
  color: '#ccc',
  width: '20px',
  height: '20px',
  cursor: 'pointer'
};

export const sideToolStyle = {
  width: '28px',
  height: '28px',
  background: 'transparent',
  border: '1px solid transparent',
  cursor: 'pointer',
  fontSize: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

export const getToolStyle = (active) => ({
  ...sideToolStyle,
  background: active ? '#65ff00' : 'transparent',
  color: active ? '#000' : '#fff',
  border: active ? '1px solid #555' : '1px solid transparent'
});

export const psBtn = {
  padding: '4px 8px',
  background: '#444',
  border: 'none',
  color: '#ccc',
  cursor: 'pointer',
  fontSize: '10px'
};

export const psBtnPrimary = {
  padding: '4px 12px',
  background: '#0078d4',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 'bold'
};

export const miniBtn = {
  background: '#444',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  borderRadius: '2px',
  padding: '0 4px',
  fontSize: '11px'
};

export const numInputStyle = {
  width: '35px',
  background: '#222',
  border: '1px solid #444',
  color: '#0f0',
  fontSize: '10px',
  textAlign: 'center',
  padding: '2px'
};

export const sectionStyle = {
  display: 'flex',
  alignItems: 'center'
};

export const dividerStyle = {
  width: '1px',
  height: '20px',
  background: '#555'
};

export const canvasContainer = {
  position: 'relative',
  background: '#000'
};

export const layersPanelStyle = {
  width: '400px',
  background: '#333',
  borderLeft: '1px solid #282828',
  display: 'flex',
  flexDirection: 'column'
};

export const settingsPopupStyle = {
  position: 'fixed',
  top: '8px',
  right: '8px',
  width: '280px',
  height: '180px',
  background: '#333',
  border: '1px solid #444',
  padding: '12px',
  zIndex: 1000,
  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column'
};

export const settingsInputStyle = {
  background: '#111',
  border: '1px solid #555',
  color: '#65ff00',
  fontSize: '10px',
  padding: '6px',
  outline: 'none'
};

export const generatorFlyoutStyle = {
  position: 'absolute',
  left: '45px',
  top: '10px',
  background: '#333',
  border: '1px solid #444',
  borderRadius: '4px',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  zIndex: 100,
  boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
  width: '400px'
};

export const flyoutBtnStyle = {
  ...psBtn,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  justifyContent: 'flex-start',
  width: '48%',
  padding: '6px 8px',
  textAlign: 'left',
  color: '#000',
  flexGrow: 1
};

export const wizardOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.85)',
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

export const wizardModalStyle = {
  width: '750px',
  background: '#333',
  border: '1px solid #65ff00',
  boxShadow: '0 0 20px rgba(101, 255, 0, 0.2)',
  borderRadius: '4px',
  overflow: 'hidden'
};

export const wizardRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 8px',
  background: '#2a2a2a',
  borderRadius: '3px'
};

export const exportFlyoutStyle = {
  position: 'absolute',
  top: '30px',
  right: '0px',
  background: '#333',
  border: '1px solid #444',
  borderRadius: '4px',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  zIndex: 1000,
  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
  width: '180px'
};

export const projectTypeCardStyle = {
  flex: 1,
  background: '#222',
  border: '2px solid #444',
  borderRadius: '8px',
  padding: '20px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  transition: 'all 0.2s',
  color: '#ccc',
  outline: 'none',
  flexBasis: '45%'
};