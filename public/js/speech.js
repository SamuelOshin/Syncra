// ==========================================
// SYNCRA SPEECH-TO-TEXT MODULE
// ==========================================

const speechStatus = document.getElementById('speech-status');

export const speech = {
  recognition: null,
  isRecognitionActive: false,
  isMuted: false,

  init(userLang, onFinalResult, onInterimResult) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API is not supported in this browser.');
      speechStatus.textContent = 'Translation Unavailable (Unsupported browser)';
      speechStatus.className = 'speech-status idle';
      return;
    }

    this.recognition = new SpeechRecognition();
    
    const langLocales = {
      en: 'en-US',
      fr: 'fr-FR',
      es: 'es-ES',
      de: 'de-DE',
      ja: 'ja-JP'
    };
    this.recognition.lang = langLocales[userLang] || 'en-US';
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onstart = () => {
      this.isRecognitionActive = true;
      speechStatus.textContent = 'Listening...';
      speechStatus.className = 'speech-status listening';
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        this.isRecognitionActive = false;
        speechStatus.textContent = 'Mic Permission Blocked';
        speechStatus.className = 'speech-status idle';
      }
    };

    this.recognition.onend = () => {
      this.isRecognitionActive = false;
      speechStatus.textContent = 'Sleeping';
      speechStatus.className = 'speech-status idle';
      
      // Auto-restart if we are not muted
      if (!this.isMuted) {
        this.start();
      }
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        onFinalResult(finalTranscript.trim());
      } else if (interimTranscript.trim()) {
        onInterimResult(interimTranscript.trim());
      }
    };

    this.start();
  },

  start() {
    if (this.recognition && !this.isRecognitionActive && !this.isMuted) {
      try {
        this.recognition.start();
      } catch (err) {
        console.error('Error starting speech recognition:', err);
      }
    }
  },

  stop() {
    if (this.recognition && this.isRecognitionActive) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  },

  setMuted(muted) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
      speechStatus.textContent = 'Muted';
      speechStatus.className = 'speech-status idle';
    } else {
      this.start();
    }
  }
};
export default speech;
