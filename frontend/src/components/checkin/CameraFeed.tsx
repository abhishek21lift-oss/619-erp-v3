'use client';
/**
 * CameraFeed — renders the webcam video + canvas overlay.
 * The canvas is used by useFaceDetection to draw bounding boxes.
 */
import React from 'react';
import { Camera } from 'lucide-react';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  /** Color of the animated corner frame SVG */
  frameColor?: string;
  /** 0-1 opacity for the result overlay (green/red flash) */
  overlayColor?: string;
  overlayOpacity?: number;
  /** When set, the soft oval reticle glows green/red to mirror the result */
  resultTone?: 'success' | 'error' | null;
  /** Show the gentle scan-line sweep — turn off after a result */
  showScan?: boolean;
}

export default function CameraFeed({
  videoRef,
  canvasRef,
  isActive,
  frameColor = '#6366f1',
  overlayColor = 'transparent',
  overlayOpacity = 0,
  resultTone = null,
  showScan = true,
}: CameraFeedProps) {
  return (
    <div className="cf-viewport">
      {isActive ? (
        <>
          {/* Mirrored video — feels natural for selfie */}
          <video
            ref={videoRef}
            className="cf-video"
            muted
            playsInline
            autoPlay
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Canvas for bounding box drawing — also mirrored to match video */}
          <canvas
            ref={canvasRef}
            className="cf-canvas"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Result flash overlay (green success / red error) */}
          <div
            className="cf-overlay"
            style={{
              background: overlayColor,
              opacity: overlayOpacity,
              transition: 'opacity 0.4s ease',
            }}
          />
          {/* Animated corner brackets */}
          <svg className="cf-frame" viewBox="0 0 320 240" preserveAspectRatio="none">
            <path d="M24,60 L24,24 L60,24"  fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M260,24 L296,24 L296,60" fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M24,180 L24,216 L60,216" fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M296,180 L296,216 L260,216" fill="none" stroke={frameColor} strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          {/* Soft oval reticle — guides users to centre their face */}
          <div className="checkin-reticle">
            <div
              className={
                'checkin-reticle-shape' +
                (resultTone === 'success' ? ' is-success' : resultTone === 'error' ? ' is-error' : '')
              }
            />
          </div>
          {/* Subtle vertical scan line — feels alive while idle/scanning */}
          {showScan && resultTone === null && <div className="checkin-scan-ring" />}
        </>
      ) : (
        <div className="cf-placeholder">
          <div className="cf-placeholder-icon">
            <Camera size={52} />
          </div>
          <p className="cf-placeholder-title">Camera ready</p>
          <p className="cf-placeholder-sub">Position your face inside the frame</p>
        </div>
      )}
    </div>
  );
}
