// Shared types for the face check-in system

export type CheckInState =
  | 'idle'           // Camera not started
  | 'loading'        // Loading face-api models
  | 'ready'          // Models loaded, camera ready, scanning
  | 'liveness'       // Face detected, waiting for blink anti-spoof
  | 'recognizing'    // Blink confirmed, running recognition
  | 'checking_in'    // API call in progress
  | 'success'        // Matched + checked in
  | 'fail_unknown'   // No face match found
  | 'fail_expired'   // Matched but membership expired
  | 'fail_multiple'  // Multiple faces in frame
  | 'no_permission'  // Camera access denied
  | 'error';         // Generic error

export interface FaceDescriptorEntry {
  clientId: string;
  name: string;
  descriptor: number[]; // Float32Array serialized as number[]
}

export interface CheckInResult {
  success: boolean;
  message: string;
  clientName?: string;
  clientId?: string;
  membershipStatus?: 'active' | 'expired' | 'frozen';
}

export interface DetectionResult {
  detected: boolean;
  multipleFaces: boolean;
  box?: { x: number; y: number; width: number; height: number };
  descriptor?: Float32Array;
  landmarks?: Array<{ x: number; y: number }>;
  earLeft?: number;   // Eye Aspect Ratio left eye
  earRight?: number;  // Eye Aspect Ratio right eye
}
