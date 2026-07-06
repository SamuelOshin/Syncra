// ==========================================
// SYNCRA LIVEKIT MEDIA ENGINE
// ==========================================

import { api } from '../api.js';
import { ui } from '../ui.js';

export const LiveKitEngine = {
  room: null,
  isMuted: false,
  isCameraOff: false,

  async connect(roomId, username, socket) {
    console.log('[LiveKitEngine] Initializing LiveKit Connection...');
    
    // 1. Ensure LiveKit SDK is loaded
    try {
      await this.ensureSdkLoaded();
    } catch (err) {
      console.error('[LiveKitEngine] Failed to load LiveKit Client SDK:', err);
      ui.showToast('Failed to load LiveKit media library', 'error');
      throw err;
    }

    // 2. Fetch LiveKit Token from backend
    let token, url;
    try {
      const response = await api.getLiveKitToken(roomId, username);
      token = response.data.token;
      url = response.data.url;
    } catch (err) {
      console.error('[LiveKitEngine] Error fetching LiveKit token:', err);
      ui.showToast('Failed to get meeting room token', 'error');
      throw err;
    }

    const sdk = window.LivekitClient || window.LiveKitClient;
    const { Room, RoomEvent, Track } = sdk;

    // 3. Configure the LiveKit Room
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
      }
    });

    // 4. Setup event listeners for remote participants
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log(`[LiveKitEngine] Track subscribed from ${participant.identity}:`, track.kind);
      if (track.kind === Track.Kind.Video) {
        this.createOrUpdateRemoteVideo(participant, track);
      } else if (track.kind === Track.Kind.Audio) {
        this.attachRemoteAudio(participant, track);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log(`[LiveKitEngine] Track unsubscribed from ${participant.identity}:`, track.kind);
      if (track.kind === Track.Kind.Video) {
        this.removeRemoteVideo(participant);
      }
    });

    this.room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (publication.kind === Track.Kind.Video) {
        const placeholder = document.getElementById(`peer-avatar-placeholder-${participant.sid}`);
        if (placeholder) placeholder.classList.add('active');
      }
    });

    this.room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (publication.kind === Track.Kind.Video) {
        const placeholder = document.getElementById(`peer-avatar-placeholder-${participant.sid}`);
        if (placeholder) placeholder.classList.remove('active');
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log(`[LiveKitEngine] Participant connected: ${participant.identity}`);
      if (typeof window.syncraUpdateParticipants === 'function') {
        window.syncraUpdateParticipants();
      }
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log(`[LiveKitEngine] Participant disconnected: ${participant.identity}`);
      this.removeRemoteVideo(participant);
      if (typeof window.syncraUpdateParticipants === 'function') {
        window.syncraUpdateParticipants();
      }
    });

    // 5. Connect to the room and publish local tracks
    try {
      await this.room.connect(url, token);
      console.log(`[LiveKitEngine] Connected to room: ${roomId} as ${username}`);
      if (typeof window.syncraUpdateParticipants === 'function') {
        window.syncraUpdateParticipants();
      }

      // Set local avatar initials
      const localAvatarCircle = document.getElementById('local-avatar-circle');
      if (localAvatarCircle && username) {
        localAvatarCircle.textContent = ui.getInitials(username);
      }

      const cameraDeviceId = localStorage.getItem('syncra_preferred_camera_id');
      const micDeviceId = localStorage.getItem('syncra_preferred_mic_id');

      // Enable local tracks with saved constraints and fallbacks
      try {
        await this.room.localParticipant.enableCameraAndMicrophone({
          video: cameraDeviceId ? { deviceId: { ideal: cameraDeviceId } } : true,
          audio: micDeviceId ? { 
            deviceId: { ideal: micDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (mediaErr) {
        console.warn('[LiveKitEngine] Failed to enable camera+mic, trying mic-only...', mediaErr);
        try {
          // Use the correct API for mic-only — do NOT call enableCameraAndMicrophone
          await this.room.localParticipant.setMicrophoneEnabled(true, micDeviceId ? {
            deviceId: { ideal: micDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          });
          console.log('[LiveKitEngine] Mic-only fallback succeeded. Camera disabled.');
          this.isCameraOff = true;
          const localPlaceholder = document.getElementById('local-avatar-placeholder');
          if (localPlaceholder) localPlaceholder.classList.add('active');
        } catch (audioErr) {
          console.error('[LiveKitEngine] Mic-only fallback also failed. Joining as viewer.', audioErr);
          ui.showToast('Microphone and camera unavailable. Joining as viewer.', 'warning');
          this.isMuted = true;
          this.isCameraOff = true;
          const localPlaceholder = document.getElementById('local-avatar-placeholder');
          if (localPlaceholder) localPlaceholder.classList.add('active');
        }
      }

      // Attach local video to UI
      const localVideo = document.getElementById('local-video');
      if (localVideo) {
        const videoTrack = this.room.localParticipant.getTrack(Track.Source.Camera);
        if (videoTrack && videoTrack.track) {
          videoTrack.track.attach(localVideo);
        }
      }

      // Attach local audio visualizer
      const localVoiceIndicator = document.getElementById('local-voice-indicator');
      if (localVoiceIndicator) {
        const audioTrack = this.room.localParticipant.getTrack(Track.Source.Microphone);
        if (audioTrack && audioTrack.track && audioTrack.track.mediaStreamTrack) {
          const stream = new MediaStream([audioTrack.track.mediaStreamTrack]);
          this.setupAudioVisualizer(stream, localVoiceIndicator);
        }
      }

      // Join the socket.io room for captions and control events (like meeting-ended)
      socket.emit('join-room', { roomId, username });

    } catch (err) {
      console.error('[LiveKitEngine] Error connecting to LiveKit room:', err);
      this.cleanup();
      throw err;
    }
  },

  ensureSdkLoaded() {
    if (window.LivekitClient || window.LiveKitClient) return Promise.resolve();
    
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    console.log('[LiveKitEngine] Loading LiveKit Client SDK...');
    return loadScript('/js/livekit-client.umd.min.js')
      .then(() => {
        console.log('[LiveKitEngine] LiveKit Client SDK loaded successfully from local source.');
      })
      .catch((localErr) => {
        console.warn('[LiveKitEngine] Failed to load local SDK, falling back to CDN...', localErr);
        return loadScript('https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js')
          .then(() => {
            console.log('[LiveKitEngine] LiveKit Client SDK loaded successfully from CDN.');
          });
      });
  },

  createOrUpdateRemoteVideo(participant, track) {
    const container = document.getElementById('remote-videos-container');
    if (!container) return;

    const peerId = participant.sid;
    let videoCard = document.getElementById(`peer-card-${peerId}`);
    const initials = ui.getInitials(participant.identity);
    
    if (!videoCard) {
      videoCard = document.createElement('div');
      videoCard.id = `peer-card-${peerId}`;
      videoCard.className = 'video-card';

      videoCard.innerHTML = `
        <div class="video-wrapper">
          <video id="peer-video-${peerId}" autoplay playsinline></video>
          <div class="video-avatar-placeholder" id="peer-avatar-placeholder-${peerId}">
            <div class="video-avatar-circle">${ui.escapeHtml(initials)}</div>
          </div>
          <div class="voice-indicator" id="peer-voice-${peerId}"></div>
        </div>
        <div class="participant-tag">
          <span id="peer-name-${peerId}">${ui.escapeHtml(participant.identity)}</span>
        </div>
      `;
      container.appendChild(videoCard);
    }

    const videoEl = document.getElementById(`peer-video-${peerId}`);
    if (videoEl) {
      track.attach(videoEl);
    }

    // Set initial video visibility based on track mute state
    const placeholder = document.getElementById(`peer-avatar-placeholder-${peerId}`);
    if (placeholder) {
      if (track.isMuted) {
        placeholder.classList.add('active');
      } else {
        placeholder.classList.remove('active');
      }
    }
  },

  attachRemoteAudio(participant, track) {
    const peerId = participant.sid;
    
    // Create an audio element if it doesn't exist
    let audioEl = document.getElementById(`peer-audio-${peerId}`);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `peer-audio-${peerId}`;
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
    }

    track.attach(audioEl);

    // Bind audio visualizer to remote participant's tag
    const voiceIndicator = document.getElementById(`peer-voice-${peerId}`);
    if (voiceIndicator && track.mediaStreamTrack) {
      const stream = new MediaStream([track.mediaStreamTrack]);
      this.setupAudioVisualizer(stream, voiceIndicator);
    }
  },

  removeRemoteVideo(participant) {
    const peerId = participant.sid;
    const card = document.getElementById(`peer-card-${peerId}`);
    if (card) card.remove();

    const audioEl = document.getElementById(`peer-audio-${peerId}`);
    if (audioEl) audioEl.remove();
  },

  toggleMute(isMuted) {
    this.isMuted = isMuted;
    if (this.room && this.room.localParticipant) {
      this.room.localParticipant.setMicrophoneEnabled(!isMuted);
    }
  },

  toggleCamera(isCameraOff) {
    this.isCameraOff = isCameraOff;
    if (this.room && this.room.localParticipant) {
      this.room.localParticipant.setCameraEnabled(!isCameraOff);
    }
    const localPlaceholder = document.getElementById('local-avatar-placeholder');
    if (localPlaceholder) {
      if (isCameraOff) {
        localPlaceholder.classList.add('active');
      } else {
        localPlaceholder.classList.remove('active');
      }
    }
  },

  async switchDevice(type, deviceId) {
    if (!this.room || !this.room.localParticipant) return;
    const sdk = window.LivekitClient || window.LiveKitClient;
    const { Track } = sdk;

    try {
      if (type === 'video') {
        await this.room.localParticipant.setCameraEnabled(false);
        await this.room.localParticipant.setCameraEnabled(true, { deviceId });
        
        // Re-attach to local video element
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
          const cameraTrack = this.room.localParticipant.getTrack(Track.Source.Camera);
          if (cameraTrack && cameraTrack.track) {
            cameraTrack.track.attach(localVideo);
          }
        }
      } else {
        await this.room.localParticipant.setMicrophoneEnabled(false);
        await this.room.localParticipant.setMicrophoneEnabled(true, { 
          deviceId,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        });

        // Re-attach local audio visualizer
        const localVoiceIndicator = document.getElementById('local-voice-indicator');
        if (localVoiceIndicator) {
          const audioTrack = this.room.localParticipant.getTrack(Track.Source.Microphone);
          if (audioTrack && audioTrack.track && audioTrack.track.mediaStreamTrack) {
            const stream = new MediaStream([audioTrack.track.mediaStreamTrack]);
            this.setupAudioVisualizer(stream, localVoiceIndicator);
          }
        }
      }
      console.log(`[LiveKitEngine] Switched ${type} device to ${deviceId}`);
    } catch (err) {
      console.error(`[LiveKitEngine] Error switching ${type} device:`, err);
      throw err;
    }
  },

  cleanup() {
    if (this.room) {
      try {
        this.room.disconnect();
      } catch (e) {}
      this.room = null;
    }

    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.srcObject = null;

    const container = document.getElementById('remote-videos-container');
    if (container) container.innerHTML = '';
  },

  setupAudioVisualizer(stream, indicatorElement) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);

      const checkVolume = () => {
        if (!this.room) return; // Stop visualizer loop if disconnected
        if (!stream.active) return;
        
        analyser.getByteFrequencyData(dataArray);
        let values = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          values += dataArray[i];
        }
        
        const average = values / bufferLength;
        
        if (average > 12) {
          indicatorElement.classList.add('speaking');
        } else {
          indicatorElement.classList.remove('speaking');
        }
        
        requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('[LiveKitEngine] Audio Visualizer failed to start:', err);
    }
  }
};
export default LiveKitEngine;
