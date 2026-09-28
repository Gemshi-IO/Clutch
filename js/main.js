/**
 * Clutch — Apple-Tier Interactive Experience Script
 * Pure Vanilla JavaScript • Zero Dependencies • Web Audio API • 60fps Micro-Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initStickyHeader();
  initHeroDeviceTilt();
  initViewSwitcher();
  initFluffSimulator();
  initAudioDigestPlayer();
  initCollectionsSwitcher();
  initFaqAccordion();
  initModalSystem();
  initMobileNav();
  initSmoothScroll();
});

/* ==========================================================================
   01. Theme Toggle (Dark / Light Mode)
   ========================================================================== */
function initThemeToggle() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (!themeToggleBtn) return;

  // Retrieve stored theme or default to dark
  const currentTheme = localStorage.getItem('pb_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme);

  themeToggleBtn.addEventListener('click', () => {
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = activeTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pb_theme', newTheme);
    updateThemeIcon(newTheme);
    showToast(`Switched to ${newTheme === 'light' ? 'Light' : 'Dark'} mode`);
  });
}

function updateThemeIcon(theme) {
  const sunIcon = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  if (!sunIcon || !moonIcon) return;

  if (theme === 'light') {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
}

/* ==========================================================================
   02. Sticky Header Glass Materialization
   ========================================================================== */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/* ==========================================================================
   03. Hero iPhone 3D Tilt Effect
   ========================================================================== */
function initHeroDeviceTilt() {
  const stage = document.querySelector('.hero-stage-container');
  const device = document.querySelector('.device-frame-wrapper');
  if (!stage || !device) return;

  // Only apply 3D tilt on devices with hover capability
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stage.addEventListener('mousemove', (e) => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const rotateX = -(y / rect.height) * 14;
      const rotateY = (x / rect.width) * 14;

      device.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    });

    stage.addEventListener('mouseleave', () => {
      device.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  }
}

/* ==========================================================================
   04. View Switcher (Liquid Masonry vs. Compact List)
   ========================================================================== */
function initViewSwitcher() {
  const btnMasonry = document.getElementById('btnViewMasonry');
  const btnList = document.getElementById('btnViewList');
  const viewMasonry = document.getElementById('viewScreenMasonry');
  const viewList = document.getElementById('viewScreenList');
  const featureCards = document.querySelectorAll('.feature-point-card');

  if (!btnMasonry || !btnList || !viewMasonry || !viewList) return;

  function switchToView(viewName) {
    if (viewName === 'masonry') {
      btnMasonry.classList.add('active');
      btnList.classList.remove('active');
      viewMasonry.classList.remove('hidden');
      viewList.classList.add('hidden');
      
      if (featureCards[0]) featureCards[0].classList.add('active');
      if (featureCards[1]) featureCards[1].classList.remove('active');
    } else {
      btnList.classList.add('active');
      btnMasonry.classList.remove('active');
      viewList.classList.remove('hidden');
      viewMasonry.classList.add('hidden');
      
      if (featureCards[1]) featureCards[1].classList.add('active');
      if (featureCards[0]) featureCards[0].classList.remove('active');
    }
  }

  btnMasonry.addEventListener('click', () => switchToView('masonry'));
  btnList.addEventListener('click', () => switchToView('list'));

  // Also hook card clicks
  featureCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      if (index === 0) switchToView('masonry');
      if (index === 1) switchToView('list');
    });
  });
}

/* ==========================================================================
   05. "Cut the Fluff" On-Device AI Simulator
   ========================================================================== */
function initFluffSimulator() {
  const btnRaw = document.getElementById('btnSimRaw');
  const btnClean = document.getElementById('btnSimClean');
  const contentBox = document.getElementById('simContentBox');
  const wordCount = document.getElementById('simWordCount');
  const readTime = document.getElementById('simReadTime');
  const savingsStat = document.getElementById('simSavingsStat');
  const screenClean = document.getElementById('readerScreenClean');
  const screenRaw = document.getElementById('readerScreenRaw');
  const modePill = document.getElementById('readerModePill');
  const pillText = document.getElementById('readerPillText');
  const mockupFrame = document.getElementById('readerMockupFrame');

  if (!btnRaw || !btnClean || !contentBox) return;

  const rawHtml = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
      <span style="background: rgba(255, 69, 58, 0.15); color: #ff453a; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 700;">⚠️ RAW WEB VIEW • 3 Invasive Ads</span>
      <span style="font-size: 0.75rem; color: var(--text-tertiary); font-family: var(--font-mono);">joyfoodsunshine.com</span>
    </div>
    <div style="padding: 8px 12px; margin-bottom: 10px; border-radius: var(--radius-xs); background: rgba(255, 159, 10, 0.1); border: 1px dashed rgba(255, 159, 10, 0.35); font-size: 0.76rem; color: #ff9f0a; display: flex; align-items: center; justify-content: space-between;">
      <span>[SPONSORED AD] Microwave Ovens: Up to 25% Off Today</span>
      <span style="font-size: 0.68rem; opacity: 0.8;">Banner</span>
    </div>
    <h4 style="color: var(--text-primary); margin-bottom: 6px;">The Best Chocolate Chip Cookie Recipe Ever</h4>
    <p style="font-size: 0.82rem; line-height: 1.5; margin-bottom: 8px; color: var(--text-secondary);">
      Everyone needs a classic chocolate chip cookie recipe in their repertoire, and this is mine. It is seriously the Best Chocolate Chip Cookie Recipe Ever! I have been making these for many, many years and everyone who tries them agrees they’re out-of-this-world delicious!
    </p>
    <div style="padding: 8px 12px; margin-bottom: 8px; border-radius: var(--radius-xs); background: rgba(255, 69, 58, 0.1); border: 1px solid rgba(255, 69, 58, 0.25); font-size: 0.76rem; color: #ff453a;">
      ▶ Video Ad Overlay Playing: "Ad ends in 3s" • Audio muted
    </div>
    <p style="font-size: 0.8rem; line-height: 1.5; color: var(--text-tertiary);">
      Plus, there's no funny ingredients, no chilling etc. Just a simple, straightforward recipe for chewy cookies... <em style="color: var(--accent-coral);">(Scroll through 2,800 words of backstory to find ingredients)</em>
    </p>
  `;

  const cleanHtml = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: rgba(48, 209, 88, 0.15); color: #30D158; padding: 2px 8px; border-radius: 99px; font-size: 0.78rem; font-weight: 700;">✨ AT A GLANCE • FoundationModels</span>
        <span style="font-size: 0.8rem; color: var(--text-tertiary);">Recipe Classified</span>
      </div>
      <span style="font-size: 0.75rem; color: var(--accent-cyan); font-family: var(--font-mono);">joyfoodsunshine.com</span>
    </div>
    <h4 style="color: var(--text-primary); margin-bottom: 4px;">The Best Chocolate Chip Cookie Recipe Ever</h4>
    <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-bottom: 12px;">Laura Sandford • Prep: 10 mins • Cook: 8 mins • Total: 30 mins • Yield: 36</p>
    <div style="margin-bottom: 12px; line-height: 1.5; background: rgba(255,255,255,0.035); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);">
      <strong style="color: var(--text-primary); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px;">Summary:</strong><br>
      Preheat oven to 375°F. Line three baking sheets with parchment paper. Cream butter and sugars, beat in eggs and vanilla, followed by dry ingredients and chocolate chips.
    </div>
    <div style="line-height: 1.6; font-size: 0.86rem;">
      <strong style="color: var(--text-primary);">Ingredients Checklist:</strong><br>
      <span style="color: #30D158; font-weight: 700;">✓</span> 1 cup salted butter (softened)<br>
      <span style="color: var(--text-secondary);">○</span> 1 cup granulated sugar • 1 cup light brown sugar (packed)<br>
      <span style="color: var(--text-secondary);">○</span> 2 tsp pure vanilla extract • 2 large eggs • 3 cups all-purpose flour
    </div>
  `;

  function setMode(mode) {
    if (mode === 'clean') {
      btnClean.classList.add('active');
      btnRaw.classList.remove('active');
      contentBox.innerHTML = cleanHtml;
      if (wordCount) wordCount.textContent = '118 words';
      if (readTime) readTime.textContent = '30 sec glance';
      if (savingsStat) {
        savingsStat.textContent = '96% fluff eliminated';
        savingsStat.style.color = 'var(--accent-mint)';
      }
      if (screenClean) {
        screenClean.classList.remove('hidden');
        screenClean.classList.add('active');
      }
      if (screenRaw) {
        screenRaw.classList.remove('active');
        screenRaw.classList.add('hidden');
      }
      if (modePill) {
        modePill.className = 'reader-mode-pill clean';
      }
      if (pillText) {
        pillText.textContent = '✨ Clutch Clean Reader';
      }
    } else {
      btnRaw.classList.add('active');
      btnClean.classList.remove('active');
      contentBox.innerHTML = rawHtml;
      if (wordCount) wordCount.textContent = '3,140 words';
      if (readTime) readTime.textContent = '12 min scroll';
      if (savingsStat) {
        savingsStat.textContent = '0% fluff removed (3 Ads)';
        savingsStat.style.color = '#ff453a';
      }
      if (screenRaw) {
        screenRaw.classList.remove('hidden');
        screenRaw.classList.add('active');
      }
      if (screenClean) {
        screenClean.classList.remove('active');
        screenClean.classList.add('hidden');
      }
      if (modePill) {
        modePill.className = 'reader-mode-pill raw';
      }
      if (pillText) {
        pillText.textContent = '⚠️ Safari Web View (Ads & Popups)';
      }
    }
  }

  btnRaw.addEventListener('click', () => setMode('raw'));
  btnClean.addEventListener('click', () => {
    setMode('clean');
    showToast('✨ On-Device Apple Intelligence Extracted');
  });

  if (mockupFrame) {
    mockupFrame.addEventListener('click', () => {
      const isClean = btnClean.classList.contains('active');
      setMode(isClean ? 'raw' : 'clean');
      if (!isClean) {
        showToast('✨ On-Device Apple Intelligence Extracted');
      }
    });

    mockupFrame.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const isClean = btnClean.classList.contains('active');
        setMode(isClean ? 'raw' : 'clean');
      }
    });
  }
}

/* ==========================================================================
   06. Daily Digest Interactive Audio Player (Web Audio API Synthesizer)
   ========================================================================== */
function initAudioDigestPlayer() {
  const playPauseBtn = document.getElementById('audioPlayPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playerCard = document.querySelector('.audio-player-sim-card');
  const scrubberFill = document.querySelector('.audio-scrubber-fill');
  const scrubberTrack = document.querySelector('.audio-scrubber-track');
  const currentTimeEl = document.getElementById('audioCurrentTime');
  const totalTimeEl = document.getElementById('audioTotalTime');
  const speedBtns = document.querySelectorAll('.speed-pill-btn');
  const prevBtn = document.getElementById('audioPrevBtn');
  const nextBtn = document.getElementById('audioNextBtn');
  const storyTitleEl = document.getElementById('audioStoryTitle');
  const storyCountEl = document.getElementById('audioStoryCount');

  if (!playPauseBtn || !playerCard) return;

  let isPlaying = false;
  let progress = 0.22;
  let playbackInterval = null;
  let currentStoryIndex = 0;
  let currentSpeed = 1.0;

  const stories = [
    { title: "If AI really could kill us all, why give any ground to China?", duration: 90 },
    { title: "AI regulation faces deadlock as calls grow for Congress to act", duration: 75 },
    { title: "Designing with Liquid Glass: Apple HIG Next Horizon", duration: 60 },
    { title: "SwiftUI Font and Texts — Dynamic Type Mastery", duration: 80 }
  ];

  // Web Audio Context for pleasant synthesized preview chime
  let audioCtx = null;

  function playTone(freq, duration, type = 'sine') {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      // AudioContext unavailable or blocked by browser policy
    }
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
      playerCard.classList.add('playing');
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';

      // Play soft harmonic Apple-style acoustic chord
      playTone(523.25, 0.4, 'sine'); // C5
      setTimeout(() => playTone(659.25, 0.4, 'sine'), 100); // E5
      setTimeout(() => playTone(783.99, 0.6, 'sine'), 200); // G5

      showToast('🎙️ Daily Digest playing demo audio...');

      playbackInterval = setInterval(() => {
        progress += (0.015 * currentSpeed);
        if (progress >= 1) {
          progress = 0;
          nextStory();
        }
        updateScrubberUI();
      }, 300);
    } else {
      playerCard.classList.remove('playing');
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      clearInterval(playbackInterval);
    }
  }

  function updateScrubberUI() {
    if (scrubberFill) {
      scrubberFill.style.width = `${(progress * 100).toFixed(1)}%`;
    }
    const totalSec = stories[currentStoryIndex].duration;
    const currentSec = Math.floor(progress * totalSec);
    if (currentTimeEl) {
      const min = Math.floor(currentSec / 60);
      const sec = currentSec % 60;
      currentTimeEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }
    if (totalTimeEl) {
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      totalTimeEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }
  }

  function updateStoryUI() {
    if (storyTitleEl) storyTitleEl.textContent = stories[currentStoryIndex].title;
    if (storyCountEl) storyCountEl.textContent = `Story ${currentStoryIndex + 1} of ${stories.length}`;
    progress = 0;
    updateScrubberUI();
  }

  function nextStory() {
    currentStoryIndex = (currentStoryIndex + 1) % stories.length;
    updateStoryUI();
    if (isPlaying) {
      playTone(783.99, 0.3);
    }
  }

  function prevStory() {
    currentStoryIndex = (currentStoryIndex - 1 + stories.length) % stories.length;
    updateStoryUI();
    if (isPlaying) {
      playTone(523.25, 0.3);
    }
  }

  playPauseBtn.addEventListener('click', togglePlay);
  if (nextBtn) nextBtn.addEventListener('click', nextStory);
  if (prevBtn) prevBtn.addEventListener('click', prevStory);

  // Scrubber Track Click to Seek
  if (scrubberTrack) {
    scrubberTrack.addEventListener('click', (e) => {
      const rect = scrubberTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      progress = Math.max(0, Math.min(1, clickX / rect.width));
      updateScrubberUI();
    });
  }

  // Speed Pills
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = parseFloat(btn.dataset.speed || '1.0');
      showToast(`Playback speed set to ${currentSpeed}×`);
    });
  });

  updateScrubberUI();
}

/* ==========================================================================
   07. Collections & Organization Switcher
   ========================================================================== */
function initCollectionsSwitcher() {
  const tabShelves = document.getElementById('colTabShelves');
  const tabTypes = document.getElementById('colTabTypes');
  const imgScreen = document.getElementById('colScreenImg');
  const titleEl = document.getElementById('colActiveTitle');
  const descEl = document.getElementById('colActiveDesc');

  if (!tabShelves || !tabTypes || !imgScreen) return;

  tabShelves.addEventListener('click', () => {
    tabShelves.classList.add('active');
    tabTypes.classList.remove('active');
    imgScreen.src = 'images/CollectionpageScrn.webp';
    imgScreen.alt = 'Clutch Shelves Screen';
    if (titleEl) titleEl.textContent = 'User Shelves & "Suggest a Shelf"';
    if (descEl) descEl.textContent = 'Curate personal shelves like Recipes and News. When Apple Intelligence detects related unread items, the sparkle action gently offers a one-tap shelf suggestion.';
  });

  tabTypes.addEventListener('click', () => {
    tabTypes.classList.add('active');
    tabShelves.classList.remove('active');
    imgScreen.src = 'images/CollecitonPageTypeScrn.webp';
    imgScreen.alt = 'Clutch Types Classification Screen';
    if (titleEl) titleEl.textContent = 'Automatic Format Classification';
    if (descEl) descEl.textContent = 'Instantly filter across Articles, Videos, Social feeds, Forums, and Documents without having to create tedious manual tags.';
  });
}

/* ==========================================================================
   08. Interactive FAQ Accordion
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question-btn');
    const answerPane = item.querySelector('.faq-answer-pane');

    if (!questionBtn || !answerPane) return;

    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all other accordion items for clean single-open behavior
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('open');
          const otherPane = otherItem.querySelector('.faq-answer-pane');
          if (otherPane) otherPane.style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove('open');
        answerPane.style.maxHeight = null;
      } else {
        item.classList.add('open');
        answerPane.style.maxHeight = answerPane.scrollHeight + 30 + 'px';
      }
    });
  });
}

/* ==========================================================================
   09. Modal System (TestFlight Beta & Waitlist)
   ========================================================================== */
function initModalSystem() {
  const modal = document.getElementById('betaModal');
  const openButtons = document.querySelectorAll('.open-beta-modal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const waitlistForm = document.getElementById('waitlistForm');

  if (!modal) return;

  function openModal(e) {
    if (e) e.preventDefault();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  openButtons.forEach(btn => btn.addEventListener('click', openModal));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Click outside backdrop to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Handle Waitlist Form
  if (waitlistForm) {
    waitlistForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = waitlistForm.querySelector('input[type="email"]');
      if (emailInput && emailInput.value) {
        const userEmail = emailInput.value.trim();
        // Open user's email client directly with prefilled invite request to developer
        window.location.href = `mailto:gemshi@me.com?subject=Clutch%20TestFlight%20Invite%20Request&body=Hi%20Gemshi%2C%0D%0A%0D%0APlease%20add%20my%20Apple%20ID%20to%20the%20Clutch%20TestFlight%20beta%3A%0D%0A${encodeURIComponent(userEmail)}`;
        showToast(`🎉 Opening invite email for ${userEmail}...`);
        emailInput.value = '';
        closeModal();
      }
    });
  }
}

/* ==========================================================================
   10. Toast Notification Helper
   ========================================================================== */
function showToast(text) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.innerHTML = `<span>${text}</span>`;
  container.appendChild(toast);

  // Trigger entrance
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Remove after 3.2s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

/* ==========================================================================
   11. Mobile Navigation Drawer
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobileNavToggle');
  const drawer = document.getElementById('mobileDrawer');
  const drawerLinks = drawer ? drawer.querySelectorAll('.nav-link') : [];

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    drawer.classList.toggle('open');
  });

  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('open');
    });
  });
}

/* ==========================================================================
   12. Smooth Anchor Navigation
   ========================================================================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}
