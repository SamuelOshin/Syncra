// ==========================================
// SYNCRA MULTI-PEER P2P WEB R T C ENGINE
// ==========================================

import { ui } from '../ui.js';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export const P2PEngine = {
  localStream: null,
  peerConnections: {}, // socketId -> RTCPeerConnection
  remoteStreams: {},    // socketId -> MediaStream
  socket: null,
  roomId: null,
  username: null,
  isMuted: false,
  isCameraOff: false,

  async connect(roomId, username, socket) {
    this.roomId = roomId;
    this.username = username;
    this.socket = socket;
    
    console.log('[P2PEngine] Initializing Multi-Peer P2P Mesh Connection...');

    // 1. Get local media stream with persistent settings
    try {
      const cameraDeviceId = localStorage.getItem('syncra_preferred_camera_id');
      const micDeviceId = localStorage.getItem('syncra_preferred_mic_id');

      const constraints = {
        video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true,
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      const localVideo = document.getElementById('local-video');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }
      const localVoiceIndicator = document.getElementById('local-voice-indicator');
      if (localVoiceIndicator) {
        this.setupAudioVisualizer(this.localStream, localVoiceIndicator);
      }
    } catch (err) {
      console.warn('[P2PEngine] Error accessing media with saved constraints, falling back to defaults:', err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = document.getElementById('local-video');
        if (localVideo) localVideo.srcObject = this.localStream;
        const localVoiceIndicator = document.getElementById('local-voice-indicator');
        if (localVoiceIndicator) this.setupAudioVisualizer(this.localStream, localVoiceIndicator);
      } catch (fallbackErr) {
        console.error('[P2PEngine] Fatal: Could not access camera or microphone:', fallbackErr);
        ui.showToast('Could not access microphone/camera. Please check permissions.', 'error');
        throw fallbackErr;
      }
    }

    // 2. Setup signaling listeners
    this.setupSignalingListeners();

    // 3. Emit join room to begin peer discovery
    this.socket.emit('join-room', this.roomId);
  },

  setupSignalingListeners() {
    this.removeSignalingListeners();

    // Fired when joining: gives us list of existing socket IDs in the room
    this.socket.on('all-peers', async (peerIds) => {
      console.log('[P2PEngine] Existing peers in room:', peerIds);
      for (const peerId of peerIds) {
        // We are the joining peer, so we initiate the offer (glare prevention)
        await this.createPeerConnection(peerId, true);
      }
    });

    // Fired when another user joins: we wait for their offer
    this.socket.on('user-joined', async (peerId) => {
      console.log('[P2PEngine] New peer joined:', peerId);
      await this.createPeerConnection(peerId, false);
    });

    // Fired when receiving a WebRTC offer
    this.socket.on('offer', async ({ from, offer }) => {
      console.log('[P2PEngine] Received offer from:', from);
      let pc = this.peerConnections[from];
      if (!pc) {
        pc = await this.createPeerConnection(from, false);
      }
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process queued ICE candidates that arrived before the remote description
        if (pc.iceCandidatesQueue) {
          while (pc.iceCandidatesQueue.length > 0) {
            const cand = pc.iceCandidatesQueue.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(err => 
              console.error('[P2PEngine] Error adding queued ICE candidate:', err)
            );
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('answer', { to: from, answer });
      } catch (err) {
        console.error('[P2PEngine] Error handling WebRTC offer:', err);
      }
    });

    // Fired when receiving a WebRTC answer
    this.socket.on('answer', async ({ from, answer }) => {
      console.log('[P2PEngine] Received answer from:', from);
      const pc = this.peerConnections[from];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          
          // Process queued ICE candidates
          if (pc.iceCandidatesQueue) {
            while (pc.iceCandidatesQueue.length > 0) {
              const cand = pc.iceCandidatesQueue.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(err => 
                console.error('[P2PEngine] Error adding queued ICE candidate:', err)
              );
            }
          }
        } catch (err) {
          console.error('[P2PEngine] Error setting remote answer:', err);
        }
      }
    });

    // Fired when receiving an ICE candidate
    this.socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = this.peerConnections[from];
      if (pc) {
        // Prevent race condition: queue candidate if remote description is not set yet
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => 
            console.error('[P2PEngine] Error adding ICE candidate:', err)
          );
        } else {
          pc.iceCandidatesQueue.push(candidate);
        }
      }
    });

    // Fired when a peer leaves the room
    this.socket.on('user-left', (peerId) => {
      console.log('[P2PEngine] Peer disconnected:', peerId);
      this.handlePeerDisconnect(peerId);
    });
  },

  removeSignalingListeners() {
    if (this.socket) {
      this.socket.off('all-peers');
      this.socket.off('user-joined');
      this.socket.off('offer');
      this.socket.off('answer');
      this.socket.off('ice-candidate');
      this.socket.off('user-left');
    }
  },

  async createPeerConnection(peerId, isInitiator) {
    if (this.peerConnections[peerId]) {
      return this.peerConnections[peerId];
    }

    console.log(`[P2PEngine] Creating PeerConnection for ${peerId} (isInitiator: ${isInitiator})`);
    const pc = new RTCPeerConnection(rtcConfig);
    pc.iceCandidatesQueue = []; // Queue for race condition prevention

    this.peerConnections[peerId] = pc;

    // Attach local tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Send local ICE candidates to the specific peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    // Handle incoming remote media tracks
    pc.ontrack = (event) => {
      console.log(`[P2PEngine] Received remote tracks from peer ${peerId}`);
      const stream = event.streams[0];
      this.remoteStreams[peerId] = stream;
      this.createRemoteVideoElement(peerId, stream);
    };

    // Handle connection failures and clean up
    pc.onconnectionstatechange = () => {
      console.log(`[P2PEngine] Connection state with peer ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handlePeerDisconnect(peerId);
      }
    };

    // Create and send offer if we are the initiator (joining peer)
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('offer', { to: peerId, offer });
      } catch (err) {
        console.error(`[P2PEngine] Error creating offer for peer ${peerId}:`, err);
      }
    }

    return pc;
  },

  createRemoteVideoElement(peerId, stream) {
    const container = document.getElementById('remote-videos-container');
    if (!container) return;

    // Check if element already exists to avoid duplication
    let videoCard = document.getElementById(`peer-card-${peerId}`);
    if (!videoCard) {
      videoCard = document.createElement('div');
      videoCard.id = `peer-card-${peerId}`;
      videoCard.className = 'video-card';

      // Clean template matching the premium design system
      videoCard.innerHTML = `
        <div class="video-wrapper">
          <video id="peer-video-${peerId}" autoplay playsinline></video>
          <div class="voice-indicator" id="peer-voice-${peerId}"></div>
        </div>
        <div class="participant-tag">
          <span id="peer-name-${peerId}">Participant</span>
        </div>
      `;
      container.appendChild(videoCard);
    }

    const videoEl = document.getElementById(`peer-video-${peerId}`);
    if (videoEl) {
      videoEl.srcObject = stream;
    }

    const voiceIndicator = document.getElementById(`peer-voice-${peerId}`);
    if (voiceIndicator) {
      this.setupAudioVisualizer(stream, voiceIndicator);
    }

    if (window.lucide) window.lucide.createIcons();
  },

  handlePeerDisconnect(peerId) {
    const pc = this.peerConnections[peerId];
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      delete this.peerConnections[peerId];
    }

    delete this.remoteStreams[peerId];

    const card = document.getElementById(`peer-card-${peerId}`);
    if (card) {
      card.remove();
    }
  },

  toggleMute(isMuted) {
    this.isMuted = isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  },

  toggleCamera(isCameraOff) {
    this.isCameraOff = isCameraOff;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });
    }
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
      localVideo.style.opacity = isCameraOff ? '0.3' : '1';
    }
  },

  async switchDevice(type, deviceId) {
    if (!this.localStream) return;

    const constraints = {
      [type === 'video' ? 'video' : 'audio']: { deviceId: { exact: deviceId } }
    };

    try {
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = type === 'video' ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];
      
      const oldTracks = type === 'video' ? this.localStream.getVideoTracks() : this.localStream.getAudioTracks();
      const oldTrack = oldTracks[0];

      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      this.localStream.addTrack(newTrack);

      if (type === 'video') {
        const localVideo = document.getElementById('local-video');
        if (localVideo) localVideo.srcObject = this.localStream;
      }

      // Hot-swap the track on all active peer connections
      for (const peerId in this.peerConnections) {
        const pc = this.peerConnections[peerId];
        const senders = pc.getSenders();
        const sender = senders.find(s => s.track && s.track.kind === (type === 'video' ? 'video' : 'audio'));
        if (sender) {
          await sender.replaceTrack(newTrack);
          console.log(`[P2PEngine] Hot-swapped active ${type} track for peer ${peerId}`);
        }
      }
    } catch (err) {
      console.error('[P2PEngine] Error switching media device:', err);
      throw err;
    }
  },

  cleanup() {
    this.removeSignalingListeners();

    // Close and cleanup all peer connections
    for (const peerId in this.peerConnections) {
      this.handlePeerDisconnect(peerId);
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
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
      console.warn('[P2PEngine] Audio Visualizer failed to start:', err);
    }
  }
};
export default P2PEngine;
