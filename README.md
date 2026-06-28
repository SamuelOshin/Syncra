# LingoMeet - Real-Time Translation Call App

LingoMeet is a custom, mobile-friendly WebRTC video/audio call web application with built-in, real-time French-to-English and English-to-French translation. It uses the browser's Web Speech API for low-latency, device-native Speech-to-Text, and **OpenRouter (Gemini 2.5 Flash)** for high-quality translation, bypassing mobile OS audio sandboxing.

---

## Prerequisites
*   **Node.js** (v18 or higher is recommended, as the server uses Node's native `fetch` API).
*   **OpenRouter API Key** (Get one at [openrouter.ai](https://openrouter.ai/)).

---

## Installation

1.  Open your terminal in the `lingomeet` directory.
2.  Install the dependencies:
    ```bash
    npm install
    ```

---

## Configuration

1.  Copy the `.env.example` file to `.env`:
    ```bash
    cp .env.example .env
    ```
2.  Open the `.env` file and add your OpenRouter API key:
    ```env
    PORT=3000
    OPENROUTER_API_KEY=your_openrouter_api_key_here
    ```

---

## Running the Application

Start the development server:
```bash
npm run dev
```
The server will start on [http://localhost:3000](http://localhost:3000).

---

## How to Test

### 1. Local Verification (Two Browser Tabs)
1.  Open two separate browser tabs at `http://localhost:3000`.
2.  **Tab 1 (Manager)**:
    *   Room Name: `test-room`
    *   Your Name: `Manager`
    *   Language: `English`
    *   Click **Join Meeting** (grant mic and camera permissions).
3.  **Tab 2 (Staff)**:
    *   Room Name: `test-room`
    *   Your Name: `Staff`
    *   Language: `Français`
    *   Click **Join Meeting** (grant mic and camera permissions).
4.  Once both tabs are joined, the WebRTC video/audio connection will establish.
5.  Speak in French into Tab 2. You will see your speech transcribed in French locally, and then translated to English in real-time on Tab 1 (with a latency badge).
6.  Speak in English into Tab 1. It will translate to French in Tab 2.

### 2. Testing on Mobile Devices (Bypassing Sandboxing)
WebRTC and the Web Speech API require a **secure context** (HTTPS) to access the microphone and camera on mobile browsers (Safari on iOS, Chrome on Android).

To test on your mobile phone:
1.  Use a free tunneling tool like **ngrok** to create a secure tunnel to your local server:
    ```bash
    npx ngrok http 3000
    ```
2.  Copy the secure `https://...` URL provided by ngrok (e.g., `https://a1b2-34-56-78.ngrok-free.app`).
3.  Open this `https` URL on your phone, and send it to your staff member to open on their phone.
4.  Join the same room name. Both of you will be in a secure video call with real-time translations appearing directly on your mobile screens!
