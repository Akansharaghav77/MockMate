import React, { useRef, useEffect } from 'react';

export default function AudioVisualizer({ audioStream, isActive }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Draw static flat line when not active or no stream
    if (!isActive || !audioStream) {
      cleanupAudio();
      drawFlatLine(ctx, width, height);
      return;
    }

    // Initialize Web Audio API from passed audioStream
    async function initAudio() {
      try {
        cleanupAudio(); // Ensure clean start

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(audioStream);
        sourceRef.current = source;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const drawWave = () => {
          if (!analyserRef.current) return;
          
          animationRef.current = requestAnimationFrame(drawWave);
          analyserRef.current.getByteTimeDomainData(dataArray);

          ctx.fillStyle = 'rgba(10, 11, 16, 0.4)'; // Semitransparent to leave slight trail
          ctx.fillRect(0, 0, width, height);

          ctx.lineWidth = 2;
          
          // Glowing gradient stroke
          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, '#00f5ff');
          gradient.addColorStop(0.5, '#7c4dff');
          gradient.addColorStop(1, '#00f5ff');
          ctx.strokeStyle = gradient;
          
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(0, 245, 255, 0.5)';

          ctx.beginPath();
          const sliceWidth = (width * 1.0) / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // Normalized
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          ctx.lineTo(width, height / 2);
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset
        };

        drawWave();
      } catch (err) {
        console.warn('Microphone permission denied or unavailable for visualizer:', err);
        drawFlatLine(ctx, width, height);
      }
    }

    initAudio();

    return () => {
      cleanupAudio();
    };
  }, [isActive, audioStream]);

  const drawFlatLine = (ctx, width, height) => {
    ctx.fillStyle = '#0e0f15';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const cleanupAudio = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {}
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  return (
    <div className="visualizer-wrapper">
      <div className="flex-between">
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isActive && <span className="pulse-dot recording" style={{ width: '6px', height: '6px' }}></span>}
          {isActive ? 'MICROPHONE ACTIVE (RECORDING)' : 'MICROPHONE STANDBY'}
        </span>
      </div>
      <canvas 
        ref={canvasRef} 
        width="400" 
        height="50" 
        className="visualizer-canvas"
      />
    </div>
  );
}
