'use client';

import { useEffect, useRef, useState } from 'react';
import { samples } from '@/lib/site';
import { track } from './Track';

export function SampleGallery({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sample = samples[selected];

  useEffect(() => {
    setPlaying(false);
    videoRef.current?.pause();
  }, [selected]);

  async function play() {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setPlaying(true);
      track('sample_play', sample.id);
    } catch {
      setPlaying(false);
    }
  }

  return <div className={`gallery ${compact ? 'gallery-compact' : ''}`}>
    <div className="gallery-stage">
      <div className="device-frame">
        <video key={sample.src} ref={videoRef} className="sample-video" controls={playing} playsInline preload="none" poster={sample.poster} onEnded={() => setPlaying(false)} aria-label={sample.title}>
          <source src={sample.src} type="video/mp4" />
          Your browser does not support video playback.
        </video>
        {!playing && <button className="video-play" type="button" onClick={play} aria-label={`Play ${sample.title}`}><span aria-hidden="true">▶</span><span>Play real sample</span></button>}
      </div>
      <span className="stage-orbit stage-orbit-one" aria-hidden="true" /><span className="stage-orbit stage-orbit-two" aria-hidden="true" />
    </div>
    <div className="gallery-copy">
      <p className="eyebrow">REAL PRODUCTION EXAMPLES</p>
      <h3>{sample.title}</h3>
      <p>{sample.description}</p>
      <div className="sample-tabs" role="group" aria-label="Choose a video example">
        {samples.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} className={selected === index ? 'sample-tab active' : 'sample-tab'} onClick={() => setSelected(index)}><span>{item.label}</span><small>{item.duration}</small></button>)}
      </div>
      <p className="gallery-note">Examples of format and production. Your videos will be tailored to your business and approved material.</p>
    </div>
  </div>;
}
