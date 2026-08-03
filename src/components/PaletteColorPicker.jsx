import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function PaletteColorPicker({
  selectedColor,
  color,
  onChange,
  recentColors,
  label = 'Select Color',
  allowTransparent = false
}) {
  const [isOpen, setIsOpen] = useState(false);

  const currentColor = selectedColor !== undefined ? selectedColor : color;
  const colors = recentColors || [];

  const handleSelect = (color) => {
    onChange(color);
    setIsOpen(false);
  };

  const renderSwatch = (color) => {
    if (color === null || color === undefined || color === '') {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'repeating-linear-gradient(45deg, #555 0px, #555 4px, #333 4px, #333 8px)',
            borderRadius: '2px'
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: color,
          borderRadius: '2px'
        }}
      />
    );
  };

  const isTransparentSelected = currentColor === null || currentColor === undefined || currentColor === '';

  return (
    <>
      {/* TRIGGER BUTTON */}
      <div
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#666'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#444'}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            border: '1px solid #000',
            borderRadius: '2px',
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          {renderSwatch(currentColor)}
        </div>
        <span style={{ fontSize: '11px', color: '#eee', fontFamily: 'monospace' }}>
          {isTransparentSelected ? 'Transparent' : currentColor.toUpperCase()}
        </span>
      </div>

      {/* MODAL OVERLAY */}
      {isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)'
          }}
          onClick={() => setIsOpen(false)}
        >
          {/* MODAL CARD */}
          <div
            style={{
              background: '#252526',
              border: '1px solid #4CAF50',
              borderRadius: '8px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
              width: '550px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid #3c3c3c'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {label}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '16px',
                  lineHeight: '1',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* SWATCHES GRID */}
            <div
              style={{
                padding: '16px',
                overflowY: 'auto',
                flexGrow: 1
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(17, 1fr)',
                  gap: '6px'
                }}
              >
                {/* Transparent Option */}
                {allowTransparent && (
                  <div
                    onClick={() => handleSelect(null)}
                    style={{
                      aspectRatio: '1',
                      border: isTransparentSelected ? '2px solid #fff' : '1px solid #111',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      boxShadow: isTransparentSelected ? '0 0 4px #fff' : 'none',
                      overflow: 'hidden'
                    }}
                    title="Transparent"
                  >
                    {renderSwatch(null)}
                  </div>
                )}

                {/* Colors Grid */}
                {colors.map((color) => (
                  <div
                    key={color}
                    onClick={() => handleSelect(color)}
                    style={{
                      aspectRatio: '1',
                      border: selectedColor === color ? '2px solid #fff' : '1px solid #111',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      boxShadow: selectedColor === color ? '0 0 4px #fff' : 'none',
                      overflow: 'hidden'
                    }}
                    title={color}
                  >
                    {renderSwatch(color)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
