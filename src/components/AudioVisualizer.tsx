import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
  isPlaying?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  isRecording,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bufferLength = 64;
    let dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (analyser && isRecording) {
        bufferLength = analyser.frequencyBinCount;
        if (dataArray.length !== bufferLength) {
          dataArray = new Uint8Array(bufferLength);
        }
        analyser.getByteFrequencyData(dataArray);
      } else if (isRecording) {
        // Dynamic live pulse when actively listening/recording
        const time = Date.now() * 0.008;
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.floor(
            80 + 70 * Math.sin(time + i * 0.4) + 50 * Math.cos(time * 0.6 + i * 0.25)
          );
        }
      } else if (isPlaying) {
        // Simulated harmonic wave when speaking
        const time = Date.now() * 0.005;
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.floor(
            60 + 55 * Math.sin(time + i * 0.3) + 40 * Math.cos(time * 0.7 + i * 0.2)
          );
        }
      } else {
        // Idle flat/subtle resting state
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = 12;
        }
      }

      const barCount = 36;
      const barWidth = Math.floor(width / barCount) - 3;
      const step = Math.floor(dataArray.length / barCount) || 1;

      // Draw center-aligned mirrored frequency visualizer bars
      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] || 10;
        const normalized = Math.min(1, Math.max(0.08, value / 255));
        const barHeight = Math.max(4, normalized * (height * 0.85));

        const x = i * (barWidth + 3) + 4;
        const y = (height - barHeight) / 2;

        // Gradient color: Cyan to Emerald to Violet
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isRecording) {
          gradient.addColorStop(0, '#f43f5e'); // Rose/Red for recording
          gradient.addColorStop(0.5, '#06b6d4'); // Cyan
          gradient.addColorStop(1, '#10b981'); // Emerald
        } else if (isPlaying) {
          gradient.addColorStop(0, '#38bdf8'); // Sky
          gradient.addColorStop(1, '#818cf8'); // Indigo
        } else {
          gradient.addColorStop(0, '#334155'); // Muted slate
          gradient.addColorStop(1, '#1e293b');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isRecording, isPlaying]);

  return (
    <div className="w-full h-14 bg-slate-900/80 rounded-xl border border-slate-800/80 p-1.5 flex items-center justify-center overflow-hidden shadow-inner">
      <canvas
        ref={canvasRef}
        width={360}
        height={48}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
