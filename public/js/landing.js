// ==========================================
// SYNCRA LANDING PAGE INTERACTIVE CONTROLS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons if loaded
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // 1. THEME SYNC & MANAGEMENT
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const getTheme = () => localStorage.getItem('syncra_theme') || 'light';
  
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('syncra_theme', theme);
    
    // Update button text/icons
    if (themeToggleBtn) {
      if (theme === 'dark') {
        themeToggleBtn.innerHTML = '<i data-lucide="sun"></i><span>Light Mode</span>';
      } else {
        themeToggleBtn.innerHTML = '<i data-lucide="moon"></i><span>Dark Mode</span>';
      }
      if (window.lucide) window.lucide.createIcons();
    }
  };

  // Set initial theme
  applyTheme(getTheme());

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = getTheme() === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
    });
  }

  // 2. HERO MOCKUP LIVE STREAM SIMULATOR
  const mockCaptionsList = document.getElementById('mock-captions-list');
  const transcriptScript = [
    {
      speaker: 'Adam Joseph',
      lang: 'en',
      text: "Welcome back everyone. Let's look at the client feedback from our beta test.",
      trans: "Bienvenido de nuevo a todos. Veamos los comentarios de los clientes sobre nuestra prueba beta."
    },
    {
      speaker: 'Sofia Dianne',
      lang: 'es',
      text: "Sí, los usuarios de Madrid informaron que la latencia de traducción es excelente.",
      trans: "Yes, users in Madrid reported that the translation latency is excellent."
    },
    {
      speaker: 'Kenji Sato',
      lang: 'ja',
      text: "ユーザーインターフェースは非常に直感的だと言っていました。",
      trans: "They said the user interface is extremely intuitive."
    },
    {
      speaker: 'Marie Dubois',
      lang: 'fr',
      text: "Les performances sur mobile sont également très stables.",
      trans: "Performance on mobile is also very stable."
    }
  ];

  let scriptIndex = 0;

  function addCaptionBubble(item) {
    if (!mockCaptionsList) return;
    
    // Create element
    const li = document.createElement('li');
    li.className = 'caption-item';
    
    li.innerHTML = `
      <div class="caption-speaker">
        <span>${item.speaker}</span>
        <span class="lang">${item.lang.toUpperCase()}</span>
      </div>
      <div class="caption-text">${item.text}</div>
      <div class="caption-translation">${item.trans}</div>
    `;
    
    mockCaptionsList.appendChild(li);
    
    // Scroll to bottom
    mockCaptionsList.scrollTop = mockCaptionsList.scrollHeight;
    
    // Maintain maximum bubbles count to avoid clutter
    if (mockCaptionsList.children.length > 5) {
      mockCaptionsList.removeChild(mockCaptionsList.firstChild);
    }
  }

  // Run mock feed loop
  if (mockCaptionsList) {
    // Add initial bubble
    addCaptionBubble(transcriptScript[scriptIndex++]);
    
    setInterval(() => {
      addCaptionBubble(transcriptScript[scriptIndex]);
      scriptIndex = (scriptIndex + 1) % transcriptScript.length;
    }, 5000);
  }

  // 3. INTERACTIVE TRANSLATION PLAYGROUND
  const playgroundInput = document.getElementById('playground-input');
  const playgroundOutput = document.getElementById('playground-output');
  const targetLangSelect = document.getElementById('target-lang');
  const btnTranslate = document.getElementById('btn-translate');
  const wavesLoader = document.getElementById('waves-loader');
  const presetButtons = document.querySelectorAll('.btn-preset');

  // Translation Database for Playground Presets
  const translationsDb = {
    "We need to schedule a follow-up session next week to align on the technical requirements.": {
      es: "Necesitamos programar una sesión de seguimiento la próxima semana para alinearnos con los requisitos técnicos.",
      fr: "Nous devons planifier une session de suivi la semaine prochaine pour nous aligner sur les exigences techniques.",
      de: "Wir müssen nächste Woche eine Folgesitzung vereinbaren, um uns über die technischen Anforderungen abzustimmen.",
      ja: "技術要件について合意するために、来週フォローアップセッションをスケジュールする必要があります。"
    },
    "The translation latency has been reduced to under 500 milliseconds.": {
      es: "La latencia de traducción se ha reducido a menos de 500 milisegundos.",
      fr: "La latence de traduction a été réduite à moins de 500 millisecondes.",
      de: "Die Übersetzungslatenz wurde auf unter 500 Millisekunden reduziert.",
      ja: "翻訳の遅延は500ミリ秒未満に短縮されました。"
    },
    "Welcome to the team! We are thrilled to have you onboard.": {
      es: "¡Bienvenido al equipo! Estamos encantados de tenerte a bordo.",
      fr: "Bienvenue dans l'équipe ! Nous sommes ravis de vous accueillir parmi nous.",
      de: "Willkommen im Team! Wir freuen uns sehr, Sie an Bord zu haben.",
      ja: "チームへようこそ！ご参加いただき大変嬉しく思います。"
    }
  };

  // Preset Clicks
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (playgroundInput) {
        playgroundInput.value = btn.textContent.trim();
        // Clear old translation
        if (playgroundOutput) {
          playgroundOutput.innerHTML = '<span class="output-placeholder">Click Translate to see the result...</span>';
        }
      }
    });
  });

  // Perform translation simulation
  if (btnTranslate) {
    btnTranslate.addEventListener('click', () => {
      const text = playgroundInput.value.trim();
      const targetLang = targetLangSelect.value;
      
      if (!text) return;
      
      // Hide button / show loader
      btnTranslate.style.opacity = '0.5';
      btnTranslate.disabled = true;
      if (wavesLoader) wavesLoader.style.display = 'flex';
      if (playgroundOutput) {
        playgroundOutput.innerHTML = '<span class="output-placeholder">Processing audio stream...</span>';
      }
      
      // Simulate Deepgram STT/Translation delay
      setTimeout(() => {
        // Reset action controls
        btnTranslate.style.opacity = '1';
        btnTranslate.disabled = false;
        if (wavesLoader) wavesLoader.style.display = 'none';
        
        let translatedText = "";
        
        // Lookup matching translation or mock it
        if (translationsDb[text] && translationsDb[text][targetLang]) {
          translatedText = translationsDb[text][targetLang];
        } else {
          // Standard mock fallback translations for random typing
          const mocks = {
            es: `[Traducido]: ${text} - (Simulado en Español)`,
            fr: `[Traduit]: ${text} - (Simulé en Français)`,
            de: `[Übersetzt]: ${text} - (Simuliert in Deutsch)`,
            ja: `[翻訳済]: ${text} - (日本語に翻訳)`
          };
          translatedText = mocks[targetLang] || text;
        }
        
        // Typewriter effect output
        if (playgroundOutput) {
          playgroundOutput.innerHTML = "";
          const words = translatedText.split(" ");
          let i = 0;
          
          const typeInterval = setInterval(() => {
            if (i < words.length) {
              playgroundOutput.innerHTML += words[i] + " ";
              playgroundOutput.scrollTop = playgroundOutput.scrollHeight;
              i++;
            } else {
              clearInterval(typeInterval);
            }
          }, 60);
        }
        
      }, 1200);
    });
  }

  // 4. MOBILE HAMBURGER MENU TOGGLE
  const mobileToggle = document.getElementById('btn-mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const isVisible = navLinks.style.display === 'flex';
      
      if (isVisible) {
        navLinks.style.display = 'none';
        mobileToggle.innerHTML = '<i data-lucide="menu"></i>';
      } else {
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '74px';
        navLinks.style.left = '0';
        navLinks.style.width = '100%';
        navLinks.style.backgroundColor = 'var(--bg-glass)';
        navLinks.style.border = '1px solid var(--border-glass)';
        navLinks.style.borderRadius = '16px';
        navLinks.style.padding = '20px';
        navLinks.style.gap = '16px';
        mobileToggle.innerHTML = '<i data-lucide="x"></i>';
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // 5. DYNAMIC AUTH SESSION CHECK FOR CTAs
  async function checkAuthSession() {
    const btnSignIn = document.querySelector('.btn-signin');
    const btnLaunch = document.querySelector('.btn-primary-pill');
    
    if (!btnLaunch) return;

    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        // Logged in: Hide "Sign In" and show "Go to Dashboard"
        if (btnSignIn) btnSignIn.style.display = 'none';
        const span = btnLaunch.querySelector('span');
        if (span) span.textContent = 'Go to Dashboard';
        btnLaunch.setAttribute('href', '/app');
      } else {
        // Not logged in: Show "Sign In" and make button read "Get Started"
        if (btnSignIn) btnSignIn.style.display = 'inline-flex';
        const span = btnLaunch.querySelector('span');
        if (span) span.textContent = 'Get Started';
        btnLaunch.setAttribute('href', '/app#signup');
      }
    } catch (err) {
      if (btnSignIn) btnSignIn.style.display = 'inline-flex';
      const span = btnLaunch.querySelector('span');
      if (span) span.textContent = 'Get Started';
      btnLaunch.setAttribute('href', '/app#signup');
    }
  }

  checkAuthSession();
});
