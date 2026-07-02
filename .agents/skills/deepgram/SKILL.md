---
name: deepgram
description: Reference guidelines and patterns for integrating Deepgram Speech-to-Text (STT) and Text-to-Speech (TTS) using the Node.js SDK v5.
---

# Deepgram Integration Guidelines

This skill provides patterns, API references, and troubleshooting strategies for integrating Deepgram's audio intelligence APIs into Syncra.

---

## SDK Version & Instantiation

Syncra uses `@deepgram/sdk` **v5.5.0** (based on the auto-generated Fern API client). 

### Class Instantiation
Do NOT pass the API key as a string directly to the constructor. The constructor expects a `CustomDeepgramClientOptions` object:

```typescript
import { DeepgramClient } from '@deepgram/sdk';
import config from '../../config';

// CORRECT
const deepgram = new DeepgramClient({ apiKey: config.deepgramApiKey });
```

---

## Streaming Speech-to-Text (WebSocket)

### Connection Setup
Initialize a streaming transcription session using `deepgram.listen.v1.connect()`. 

Key configuration keys for options:
- `model`: Specify `'nova-3'` for the latest, fastest model.
- `language`: Map localized tags (e.g. `'en'` → `'en-US'`).
- `encoding`: Specify `'linear16'` for raw PCM audio.
- `sample_rate`: Set to `16000` (or the rate matching the downsampled processor).
- `interim_results`: Must be the string `'true'` (not boolean).
- `smart_format`: Must be the string `'true'` (not boolean) for punctuation/formatting.

```typescript
const connection = await deepgram.listen.v1.connect({
  model: 'nova-3',
  language: 'en-US',
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  interim_results: 'true',
  smart_format: 'true',
  utterance_end_ms: 1500
});
```

---

## WebSocket Handshake Lifecycle Management

The default SDK method `connection.waitForOpen()` has a critical limitation: it only listens to `"open"` and `"error"` events. If the socket closes during the handshake (e.g. due to invalid credentials returning 401 Unauthorized), the promise hangs indefinitely.

### Recommended Handshake Pattern
Use a custom timeout-backed handshake listener that checks state immediately and tracks `"close"` events:

```typescript
private waitForConnectionOpen(connection: any, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connection.socket;
    if (!socket || typeof socket.addEventListener !== 'function') {
      return reject(new Error('Underlying socket is not available or is invalid.'));
    }

    // Check current state immediately to prevent hanging on already closed sockets
    const state = connection.readyState !== undefined ? connection.readyState : socket.readyState;
    if (state === 1) return resolve(); // OPEN
    if (state === 2) return reject(new Error('WebSocket is already CLOSING.'));
    if (state === 3) return reject(new Error('WebSocket is already CLOSED.'));

    let timeout: NodeJS.Timeout;

    const cleanUp = () => {
      clearTimeout(timeout);
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('error', onError);
    };

    const onOpen = () => {
      cleanUp();
      resolve();
    };

    const onClose = (event: any) => {
      cleanUp();
      reject(new Error(`WebSocket closed during handshake. Code: ${event.code}, Reason: ${event.reason || 'None'}`));
    };

    const onError = (err: any) => {
      cleanUp();
      reject(new Error(`WebSocket error during handshake: ${err.message || 'unknown error'}`));
    };

    timeout = setTimeout(() => {
      cleanUp();
      reject(new Error(`WebSocket connection timeout after ${timeoutMs}ms (ReadyState: ${socket.readyState})`));
    }, timeoutMs);

    socket.addEventListener('open', onOpen);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onError);
  });
}
```

---

## Feeding Audio Chunks
To feed audio to Deepgram, verify that the session is open:

```typescript
if (session.isOpen && session.connection) {
  session.connection.sendMedia(audioBuffer);
} else {
  // Queue chunks until handshake completes
  session.buffer.push(audioBuffer);
}
```

---

## Common Pitfalls & Solutions

1. **Boolean Parameters as Strings**: Passing `smart_format: true` as a boolean can cause TypeScript warnings. Deepgram's Fern SDK generates type unions where `"true"` and `"false"` are literal strings. Pass them as strings: `'true'`.
2. **Early Audio Loss**: The client begins sending audio chunks immediately after the socket connects. Ensure you instantiate the session map synchronously *before* invoking `connect` to capture and queue early chunks, then flush them when `waitForConnectionOpen` resolves.
3. **Invalid API Key Hangs**: Handshake failures drop WebSocket connections. Always wrap your connection logic with verification tools to ensure keys are validated.
