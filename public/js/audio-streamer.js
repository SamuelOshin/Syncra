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

  /**
   * Initialize the audio streamer with socket and meeting info.
   * Does NOT start streaming — call start() after.
   */
  init(socket, roomId, language, speakerName) {
    this.socket = socket;
    this.roomId = roomId;
    this.language = language;
    this.speakerName = speakerName;
  },

  /**
   * Start capturing audio from the given MediaStream and streaming to server.
   * The MediaStream should be the SAME stream used by WebRTC.
   */
  async start(mediaStream) {
    if (this.isStreaming || !this.socket || !mediaStream) return;

    try {
      // Create AudioContext (resume needed for mobile browsers)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000 // Request 48kHz, AudioWorklet will downsample to 16kHz
      });

      // Resume AudioContext (required after user gesture on mobile)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Load the AudioWorklet processor module
      await this.audioContext.audioWorklet.addModule('/js/audio-processor.js');

      // Create source from the WebRTC MediaStream
      this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);

      // Create the AudioWorklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-stream-processor');

      // Listen for processed audio chunks from the worklet
      this.workletNode.port.onmessage = (event) => {
        if (this.isStreaming && !this.isMuted && this.socket) {
          this.socket.emit('audio-chunk', event.data);
        }
      };

      // Connect the audio graph: source → worklet → destination
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      // Signal the server to start a Deepgram STT session
      this.socket.emit('audio-stream-start', {
        roomId: this.roomId,
        language: this.language,
        speakerName: this.speakerName
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
          speakerName: this.speakerName
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
