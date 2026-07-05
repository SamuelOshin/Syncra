// ==========================================
// SYNCRA MEDIA FACADE / ENGINE ORCHESTRATOR
// ==========================================

import { P2PEngine } from './engines/p2p.engine.js';
import { LiveKitEngine } from './engines/livekit.engine.js';

export const webrtc = {
  activeEngine: null,

  /**
   * Connects to the meeting room using the specified media engine.
   * If LiveKit fails to connect, it will automatically fallback to P2P Mesh.
   */
  async connect(roomId, username, engineType, socket) {
    console.log(`[MediaFacade] Selecting engine strategy: ${engineType}`);
    
    // Ensure any previous session is cleaned up
    this.cleanup();

    if (engineType === 'livekit') {
      this.activeEngine = LiveKitEngine;
    } else {
      this.activeEngine = P2PEngine;
    }

    try {
      await this.activeEngine.connect(roomId, username, socket);
    } catch (err) {
      console.error(`[MediaFacade] Failed to connect using ${engineType} engine:`, err);
      
      // Fallback strategy: if LiveKit fails, try local P2P Mesh
      if (engineType === 'livekit') {
        console.warn('[MediaFacade] LiveKit failed, attempting fallback to local P2P Mesh...');
        this.activeEngine = P2PEngine;
        try {
          await this.activeEngine.connect(roomId, username, socket);
        } catch (fallbackErr) {
          console.error('[MediaFacade] Fallback P2P Mesh also failed:', fallbackErr);
          throw fallbackErr;
        }
      } else {
        throw err;
      }
    }
  },

  toggleMute(isMuted) {
    if (this.activeEngine) {
      this.activeEngine.toggleMute(isMuted);
    }
  },

  toggleCamera(isCameraOff) {
    if (this.activeEngine) {
      this.activeEngine.toggleCamera(isCameraOff);
    }
  },

  async switchDevice(type, deviceId) {
    if (this.activeEngine) {
      await this.activeEngine.switchDevice(type, deviceId);
    }
  },

  getLocalAudioStream() {
    if (!this.activeEngine) return null;

    try {
      // P2P engine exposes localStream directly
      if (this.activeEngine.localStream) {
        return this.activeEngine.localStream;
      }

      // LiveKit engine: extract the audio track from the room's local participant
      if (this.activeEngine.room) {
        const sdk = window.LivekitClient || window.LiveKitClient;
        const audioTrack = this.activeEngine.room.localParticipant.getTrack(
          sdk?.Track?.Source?.Microphone
        );
        if (audioTrack && audioTrack.track && audioTrack.track.mediaStreamTrack) {
          return new MediaStream([audioTrack.track.mediaStreamTrack]);
        }
      }
    } catch (err) {
      console.error('[MediaFacade] Error getting local audio stream:', err);
    }

    return null;
  },

  getParticipantsList(localUserName) {
    const list = [];
    if (localUserName) {
      list.push({ name: localUserName, isMe: true });
    }
    if (this.activeEngine) {
      if (this.activeEngine.peerUsernames) {
        for (const peerId in this.activeEngine.peerUsernames) {
          list.push({ name: this.activeEngine.peerUsernames[peerId], isMe: false });
        }
      } else if (this.activeEngine.room && this.activeEngine.room.remoteParticipants) {
        this.activeEngine.room.remoteParticipants.forEach(participant => {
          list.push({ name: participant.identity || 'Participant', isMe: false });
        });
      }
    }
    return list;
  },

  cleanup() {
    if (this.activeEngine) {
      console.log('[MediaFacade] Cleaning up active media engine...');
      try {
        this.activeEngine.cleanup();
      } catch (e) {
        console.error('[MediaFacade] Error during engine cleanup:', e);
      }
      this.activeEngine = null;
    }
  }
};
export default webrtc;
