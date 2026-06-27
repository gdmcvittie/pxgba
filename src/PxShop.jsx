import { PxShopProvider } from './context/PxShopContext';
import Dialogs from './components/Dialogs';
import Toolbar from './components/Toolbar';
import Header from './components/Header';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import TimelinePanel from './components/TimelinePanel';
import ScriptEditor from './components/ScriptEditor';
import MusicEditor from './components/MusicEditor';
import { Toaster } from 'react-hot-toast';
import WelcomeTour from './components/WelcomeTour';

const PxShop = () => {
  return (
    <PxShopProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#1e1e1e', color: '#fff', fontFamily: 'sans-serif' }}>
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
    </PxShopProvider>
  );
};

export default PxShop;