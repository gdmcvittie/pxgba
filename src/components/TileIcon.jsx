import { useEffect, useRef } from 'react';

const TileIcon = ({ tile, size = 32, style = {} }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 8, 8);

    if (tile && tile.data) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const color = tile.data[y]?.[x];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  }, [tile]);

  return (
    <canvas
      ref={canvasRef}
      width={8}
      height={8}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        imageRendering: 'pixelated',
        backgroundColor: 'transparent',
        display: 'block',
        pointerEvents: 'none',
        ...style
      }}
    />
  );
};

export default TileIcon;
