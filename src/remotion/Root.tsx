import { Composition } from 'remotion';
import type React from 'react';
import { CaptionComposition } from './Composition';
import './style.css';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CaptionVideo"
        component={CaptionComposition}
        durationInFrames={300} // Default, will be overridden
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          segments: [
            { start: 0, end: 2, text: "Welcome to Ozzy Captions" },
            { start: 2, end: 5, text: "Auto-generate your captions for free" }
          ],
          videoSrc: ""
        }}
      />
    </>
  );
};
