// ==========================================
// SYNCRA SERVER-SIDE STT AUDIO STREAMER
// Captures audio from the WebRTC media stream,
// processes it via AudioWorklet, and streams
// PCM chunks to the server for transcription.
// ==========================================

export const audioStreamer = {
  socket: null,
  audioContext: null,
  workletNode: null,
  sourceNode: null,
  isStreaming: false,
  isMuted: false,
  roomId: null,
  language: null,
  speakerName: null,
  targetLanguage: null,

  /**
   * Initialize the audio streamer with socket and meeting info.
   * Does NOT start streaming — call start() after.
   */
  init(socket, roomId, language, speakerName, targetLanguage) {
    this.socket = socket;
    this.roomId = roomId;
    this.language = language;
    this.speakerName = speakerName;
    this.targetLanguage = targetLanguage;
  },

  /**
   * Warm up and unlock the AudioContext inside a user gesture synchronously.
   * Call this synchronously in click/submit handlers before any async calls.
   */
  prepare() {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[AudioStreamer] AudioContext pre-created synchronously. State:', this.audioContext.state);
    } catch (e) {
      console.warn('[AudioStreamer] Failed to pre-create AudioContext:', e);
    }
  },

  /**
   * Start capturing audio from the given MediaStream and streaming to server.
   * The MediaStream should be the SAME stream used by WebRTC.
   */
  async start(mediaStream) {
    if (this.isStreaming || !this.socket || !mediaStream) {
      console.warn('[AudioStreamer] Skip start: isStreaming=', this.isStreaming, 'hasSocket=', !!this.socket, 'hasStream=', !!mediaStream);
      return;
    }

    const audioTracks = mediaStream.getAudioTracks();
    console.log('[AudioStreamer] MediaStream audio tracks:', audioTracks);
    if (audioTracks.length === 0) {
      console.error('[AudioStreamer] Cannot start: No audio tracks in MediaStream!');
      return;
    }

    try {
      // Use pre-created AudioContext, or create a new one
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 48000 // Request 48kHz, AudioWorklet will downsample to 16kHz
          });
          console.log('[AudioStreamer] AudioContext created with sampleRate option 48kHz. Active rate:', this.audioContext.sampleRate);
        } catch (e) {
          console.warn('[AudioStreamer] Creating AudioContext with sampleRate options failed, falling back to default:', e);
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('[AudioStreamer] AudioContext created with default sampleRate:', this.audioContext.sampleRate);
        }
      }

      // Resume AudioContext (required after user gesture on mobile)
      if (this.audioContext.state === 'suspended') {
        console.log('[AudioStreamer] AudioContext is suspended. Resuming...');
        await this.audioContext.resume();
        console.log('[AudioStreamer] AudioContext resumed. State:', this.audioContext.state);
      }

      // Load the AudioWorklet processor module
      console.log('[AudioStreamer] Loading AudioWorklet module...');
      await this.audioContext.audioWorklet.addModule('/js/audio-processor.js');
      console.log('[AudioStreamer] AudioWorklet module loaded successfully.');

      // Create source from the WebRTC MediaStream
      this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);

      // Create the AudioWorklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-stream-processor');

      // Initialize the worklet processor with the AudioContext sampleRate
      this.workletNode.port.postMessage({
        type: 'init',
        sampleRate: this.audioContext.sampleRate
      });

      // Listen for processed audio chunks from the worklet
      let chunkCount = 0;
      this.workletNode.port.onmessage = (event) => {
        if (this.isStreaming && !this.isMuted && this.socket) {
          chunkCount++;
          if (chunkCount === 1 || chunkCount % 100 === 0) {
            console.log(`[AudioStreamer] Sent ${chunkCount} audio chunks to server.`);
          }
          this.socket.emit('audio-chunk', event.data);
        }
      };

      // Connect the audio graph: source → worklet (no output to speakers to avoid echo)
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      // Signal the server to start a Deepgram STT session
      console.log('[AudioStreamer] Emitting audio-stream-start to server...');
      this.socket.emit('audio-stream-start', {
        roomId: this.roomId,
        language: this.language,
        speakerName: this.speakerName,
        targetLanguage: this.targetLanguage
      });

      this.isStreaming = true;
      console.log('[AudioStreamer] Started streaming audio to server for STT');
    } catch (err) {
      console.error('[AudioStreamer] Failed to start audio streaming:', err);
      this.cleanup();
    }
  },

  /**
   * Pause or resume streaming based on mute state.
   */
  setMuted(muted) {
    this.isMuted = muted;
    if (muted) {
      // Tell server to stop the STT session (saves resources)
      if (this.socket) {
        this.socket.emit('audio-stream-stop');
      }
      console.log('[AudioStreamer] Muted — paused audio streaming');
    } else {
      // Restart the STT session on server
      if (this.socket && this.isStreaming) {
        this.socket.emit('audio-stream-start', {
          roomId: this.roomId,
          language: this.language,
          speakerName: this.speakerName,
          targetLanguage: this.targetLanguage
        });
      }
      console.log('[AudioStreamer] Unmuted — resumed audio streaming');
    }
  },

  /**
   * Stop streaming and release all audio resources.
   */
  stop() {
    if (this.socket) {
      this.socket.emit('audio-stream-stop');
    }
    this.cleanup();
    console.log('[AudioStreamer] Stopped audio streaming');
  },

  /**
   * Internal cleanup of AudioContext and nodes.
   */
  cleanup() {
    this.isStreaming = false;

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) { /* ignore */ }
      this.sourceNode = null;
    }

    if (this.filterNode) {
      try { this.filterNode.disconnect(); } catch (e) { /* ignore */ }
      this.filterNode = null;
    }

    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch (e) { /* ignore */ }
      this.workletNode = null;
    }

    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) { /* ignore */ }
      this.audioContext = null;
    }
  }
};

export default audioStreamer;
