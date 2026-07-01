// ==========================================
// SYNCRA AUDIO WORKLET PROCESSOR
// Captures, downsamples (to 16kHz), and
// converts audio to Linear16 PCM format
// ==========================================

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 4096;
    this._buffer = new Float32Array(this._bufferSize);
    this._bytesWritten = 0;
    this._sampleRate = 48000; // default fallback

    // Listen for sample rate initialization from the main thread
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'init') {
        this._sampleRate = event.data.sampleRate;
      }
    };
  }

  /**
   * Downsample from the native sample rate to 16kHz
   */
  _downsample(inputBuffer, inputSampleRate, outputSampleRate) {
    if (inputSampleRate === outputSampleRate) {
      return inputBuffer;
    }
    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.round(inputBuffer.length / ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = Math.round(i * ratio);
      output[i] = inputBuffer[Math.min(srcIndex, inputBuffer.length - 1)];
    }
    return output;
  }

  /**
   * Convert Float32 samples to Int16 (Linear16 PCM)
   */
  _floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Mono (first channel)

    // Accumulate samples into the buffer
    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._bytesWritten++] = channelData[i];

      // When buffer is full, downsample and send
      if (this._bytesWritten >= this._bufferSize) {
        // Fall back to global sampleRate if main-thread init has not fired yet
        const currentRate = this._sampleRate || sampleRate || 48000;
        const downsampled = this._downsample(this._buffer, currentRate, 16000);
        const pcm16 = this._floatTo16BitPCM(downsampled);

        // Transfer the buffer to main thread (zero-copy)
        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);

        // Reset
        this._buffer = new Float32Array(this._bufferSize);
        this._bytesWritten = 0;
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
