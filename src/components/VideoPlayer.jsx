import { usePxShop } from '../context/PxShopContext';
import { API_BASE_URL, isDesktop } from '../config';

const VIDEOS = [
  { id: 'walkthrough', label: 'UI Walkthrough', type: 'youtube', path: 'https://www.youtube.com/embed/WbAHUjo0IHU' },
  { id: 'sample-game', label: 'Sample Game Project', type: 'youtube', path: 'https://www.youtube.com/embed/moVl1BnpZyQ' },
];

const VideoPlayer = () => {
  const { showVideoPlayerDialog, setShowVideoPlayerDialog, videoPlayerSource, setVideoPlayerSource } = usePxShop();
  if (!showVideoPlayerDialog) return null;

  const currentVideo = VIDEOS.find(v => v.id === videoPlayerSource) || VIDEOS[0];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={() => setShowVideoPlayerDialog(false)}>
      <div style={{ background: '#2a2a2a', border: '1px solid #4CAF50', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', padding: '20px', width: '720px', display: 'flex', flexDirection: 'column', gap: '15px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#4CAF50' }}>TUTORIALS</span>
          <button onClick={() => setShowVideoPlayerDialog(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {VIDEOS.map(video => (
            <button
              key={video.id}
              onClick={() => setVideoPlayerSource(video.id)}
              style={{
                flex: 1, padding: '8px', border: '1px solid', borderRadius: '4px', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '12px',
                background: videoPlayerSource === video.id ? '#4CAF50' : '#333',
                borderColor: videoPlayerSource === video.id ? '#4CAF50' : '#444',
                color: videoPlayerSource === video.id ? '#fff' : '#ccc'
              }}
            >
              {video.label}
            </button>
          ))}
        </div>

        <div style={{ background: '#000', borderRadius: '4px', overflow: 'hidden', aspectRatio: '16/9' }}>
          {currentVideo.type === 'youtube' ? (
            <iframe
              src={currentVideo.path}
              title={currentVideo.label}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ width: '100%', height: '100%', display: 'block', border: 'none' }}
            />
          ) : (
            <video
              key={currentVideo.path}
              src={currentVideo.path}
              controls
              autoPlay
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowVideoPlayerDialog(false)} style={{ padding: '10px 30px', background: 'transparent', border: '1px solid #4CAF50', color: '#4CAF50', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onMouseEnter={e => { e.target.style.background = '#4CAF50'; e.target.style.color = '#fff'; }} onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#4CAF50'; }}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
