import React from 'react';
import { useVideoConfig, useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export const CaptionComposition: React.FC<{
  segments: CaptionSegment[];
  videoSrc: string;
}> = ({ segments, videoSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const currentSegment = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  return (
    <AbsoluteFill className="bg-black">
      {/* Video layer */}
      <video
        src={videoSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
      
      {/* Caption layer */}
      <AbsoluteFill className="flex items-end justify-center pb-20">
        {currentSegment && (
          <div 
            className="bg-black/50 px-6 py-3 rounded-xl border border-teal/30"
            style={{
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            <span className="text-4xl font-bold text-teal tracking-tight drop-shadow-lg">
              {currentSegment.text.toUpperCase()}
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
