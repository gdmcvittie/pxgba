import { PxShopProvider, usePxShop } from './context/PxShopContext';
import Dialogs from './components/Dialogs';
import Toolbar from './components/Toolbar';
import Header from './components/Header';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import TimelinePanel from './components/TimelinePanel';
import ScriptEditor from './components/ScriptEditor';
import MusicEditor from './components/MusicEditor';
import StatusBar from './components/StatusBar';
import { Toaster } from 'react-hot-toast';
import WelcomeTour from './components/WelcomeTour';
import TileEditor from './components/TileEditor';

const TileEditorContainer = () => {
  const { tileEditor } = usePxShop();
  return <TileEditor key={tileEditor?.tileId ?? 'closed'} />;
};

const PxShop = () => {
  return (
    <PxShopProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#1e1e1e', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Toaster containerStyle={{ zIndex: 99999 }} />
          <Dialogs />
          <WelcomeTour />
          <Toolbar />
          <div id="tour-canvas-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Header />
            <Canvas />
            <TimelinePanel />
          </div>
          <Sidebar />
          <ScriptEditor />
          <MusicEditor />
        </div>
        <StatusBar />
      </div>
      <TileEditorContainer />
    </PxShopProvider>
  );
};

export default PxShop;