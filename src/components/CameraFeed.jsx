import React, { useRef, useEffect, useState } from 'react';

export default function CameraFeed({ videoStream }) {
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (videoStream) {
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        // Force play just in case
        videoRef.current.play().catch(e => console.warn('Video play interrupted:', e));
      }
      setCameraActive(true);
    } else {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [videoStream]);

  return (
    <div className="camera-wrapper">
      <video 
        ref={videoRef} 
        className="camera-stream" 
        autoPlay 
        playsInline 
        muted
        style={{ display: cameraActive ? 'block' : 'none' }}
      />

      {cameraActive ? (
        <div className="camera-badge">
          <span className="pulse-dot"></span>
          <span style={{ letterSpacing: '0.05em' }}>LIVE CAMERA FEED</span>
        </div>
      ) : (
        <div className="camera-placeholder">
          <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.8rem', display: 'block', margin: 'auto' }}>👤</span>
            <div 
              style={{ 
                position: 'absolute', 
                top: '-2px', 
                left: '-2px', 
                right: '-2px', 
                bottom: '-2px', 
                border: '1px solid var(--accent-cyan)', 
                borderRadius: '50%', 
                animation: 'pulse 2s infinite', 
                opacity: 0.4 
              }}
            ></div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 20px' }}>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>Virtual Interview Portal</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
              Camera is turned off or initializing...
            </p>
          </div>
          <div className="camera-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--error)' }}>
            <span className="pulse-dot" style={{ backgroundColor: 'var(--error)', boxShadow: '0 0 8px var(--error)' }}></span>
            <span>CAMERA OFFLINE</span>
          </div>
        </div>
      )}
    </div>
  );
}
