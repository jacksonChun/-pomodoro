const state = {
  isRunning: false,
  sessionType: "work", // work | rest
  workMinutes: 60,
  restMinutes: 10,
  remainingSeconds: 60 * 60,
  completedWorkSessions: 0,
  timerId: null,
  audioCtx: null,
  soundPreset: "chime", // 집중 시작(=휴식 종료) 알림
};

const SOUND_PRESETS = {
  chime: {
    tones: [
      { freq: 987.77, offset: 0.0, duration: 0.9 },
      { freq: 1318.51, offset: 0.12, duration: 1.0 },
    ],
    delayTime: 0.18,
    feedback: 0.22,
    wet: 0.22,
    gain: 0.9,
  },
  soft: {
    tones: [
      { freq: 783.99, offset: 0.0, duration: 0.8 },
      { freq: 1046.5, offset: 0.14, duration: 0.95 },
    ],
    delayTime: 0.16,
    feedback: 0.16,
    wet: 0.18,
    gain: 0.75,
  },
  bright: {
    tones: [
      { freq: 1174.66, offset: 0.0, duration: 0.75 },
      { freq: 1567.98, offset: 0.1, duration: 0.9 },
    ],
    delayTime: 0.14,
    feedback: 0.2,
    wet: 0.2,
    gain: 0.82,
  },
  upbeat: {
    tones: [
      { freq: 987.77, offset: 0.0, duration: 0.24 },
      { freq: 1244.51, offset: 0.13, duration: 0.22 },
      { freq: 1480.0, offset: 0.26, duration: 0.24 },
      { freq: 1760.0, offset: 0.42, duration: 0.42 },
    ],
    delayTime: 0.11,
    feedback: 0.14,
    wet: 0.18,
    gain: 0.92,
  },
};

const ui = {
  countText: document.getElementById("countText"),
  startPauseBtn: document.getElementById("startPauseBtn"),
  stopBtn: document.getElementById("stopBtn"),
  workRange: document.getElementById("workRange"),
  restRange: document.getElementById("restRange"),
  workValue: document.getElementById("workValue"),
  restValue: document.getElementById("restValue"),
  soundOpenBtn: document.getElementById("soundOpenBtn"),
  soundModal: document.getElementById("soundModal"),
  soundModalBackdrop: document.getElementById("soundModalBackdrop"),
  soundModalSelect: document.getElementById("soundModalSelect"),
  soundModalPreviewBtn: document.getElementById("soundModalPreviewBtn"),
  soundModalCloseBtn: document.getElementById("soundModalCloseBtn"),
  dialTicks: document.getElementById("dialTicks"),
  dialLabels: document.getElementById("dialLabels"),
  dialSvg: document.getElementById("dialSvg"),
  dialProgress: document.getElementById("dialProgress"),
  dialHit: document.getElementById("dialHit"),
  dialHand: document.getElementById("dialHand"),
  dialMinute: document.getElementById("dialMinute"),
  dialTimeText: document.getElementById("dialTimeText"),
};

const SVG_NS = "http://www.w3.org/2000/svg";
const DIAL_CX = 160;
const DIAL_CY = 160;
const DIAL_PROGRESS_RADIUS = 106;
const DIAL_SECONDS_PER_TURN = 60 * 60; // 한 바퀴 = 1시간

function totalSecondsForCurrentSession() {
  return (state.sessionType === "work" ? state.workMinutes : state.restMinutes) * 60;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function applyTheme() {
  const workBody = [
    "bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.28),transparent_33%),radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.2),transparent_30%),linear-gradient(135deg,#ff9f9f,#ffc186_48%,#ffe2b8)]",
  ];
  const restBody = [
    "bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.28),transparent_33%),radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.2),transparent_30%),linear-gradient(135deg,#8ec8ff,#78b7ff_48%,#d3e9ff)]",
  ];

  document.body.classList.remove(...workBody, ...restBody);

  if (state.sessionType === "rest") {
    document.body.classList.add(...restBody);
    ui.startPauseBtn.classList.remove("bg-[#ff875f]");
    ui.startPauseBtn.classList.add("bg-[#4d93f5]");
  } else {
    document.body.classList.add(...workBody);
    ui.startPauseBtn.classList.remove("bg-[#4d93f5]");
    ui.startPauseBtn.classList.add("bg-[#ff875f]");
  }
}

function initDialFace() {
  if (!ui.dialTicks || !ui.dialLabels) return;

  ui.dialTicks.innerHTML = "";
  ui.dialLabels.innerHTML = "";

  for (let minute = 0; minute < 60; minute += 1) {
    const major = minute % 5 === 0;
    const angle = (minute / 60) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rOuter = 126;
    const rInner = major ? 111 : 118;

    const tick = document.createElementNS(SVG_NS, "line");
    tick.setAttribute("x1", String(DIAL_CX + rInner * cos));
    tick.setAttribute("y1", String(DIAL_CY + rInner * sin));
    tick.setAttribute("x2", String(DIAL_CX + rOuter * cos));
    tick.setAttribute("y2", String(DIAL_CY + rOuter * sin));
    tick.setAttribute("stroke", major ? "#2d3340" : "#8c92a0");
    tick.setAttribute("stroke-width", major ? "3.6" : "1.6");
    tick.setAttribute("stroke-linecap", "round");
    ui.dialTicks.appendChild(tick);

    if (major) {
      const label = document.createElementNS(SVG_NS, "text");
      const labelR = 142;
      label.setAttribute("x", String(DIAL_CX + labelR * cos));
      label.setAttribute("y", String(DIAL_CY + labelR * sin + 7));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "16");
      label.setAttribute("font-weight", "800");
      label.setAttribute("fill", "#2c323d");
      label.textContent = String(minute);
      ui.dialLabels.appendChild(label);
    }
  }
}

function updateDial() {
  if (!ui.dialProgress || !ui.dialHand || !ui.dialMinute || !ui.dialTimeText) return;

  const circle = 2 * Math.PI * DIAL_PROGRESS_RADIUS;
  const secondsForDial = Math.max(0, Math.min(state.remainingSeconds, DIAL_SECONDS_PER_TURN));
  const ratio = secondsForDial / DIAL_SECONDS_PER_TURN;
  const offset = circle * (1 - ratio);

  ui.dialProgress.style.strokeDasharray = `${circle}`;
  ui.dialProgress.style.strokeDashoffset = `${offset}`;
  ui.dialProgress.style.stroke = state.sessionType === "work" ? "#e4452e" : "#2f8df8";

  const angle = ratio * Math.PI * 2 - Math.PI / 2;
  const handRadius = 106;
  const x2 = DIAL_CX + handRadius * Math.cos(angle);
  const y2 = DIAL_CY + handRadius * Math.sin(angle);
  ui.dialHand.setAttribute("x2", String(x2));
  ui.dialHand.setAttribute("y2", String(y2));

  ui.dialMinute.textContent = String(Math.ceil(secondsForDial / 60));
  ui.dialTimeText.textContent = formatTime(state.remainingSeconds);
}

function render() {
  const time = formatTime(state.remainingSeconds);
  ui.countText.textContent = `완료한 집중 세션: ${state.completedWorkSessions}`;
  ui.startPauseBtn.textContent = state.isRunning ? "일시정지" : "시작";
  ui.workValue.textContent = String(state.workMinutes);
  ui.restValue.textContent = String(state.restMinutes);
  ui.workRange.value = String(state.workMinutes);
  ui.restRange.value = String(state.restMinutes);
  if (ui.soundModalSelect) {
    ui.soundModalSelect.value = state.soundPreset;
  }
  applyTheme();
  document.title = `${time} · ${state.sessionType === "work" ? "집중" : "휴식"} · Pomodoro`;

  updateDial();
}

function minuteFromDialPointer(clientX, clientY) {
  if (!ui.dialSvg) return state.workMinutes;

  const rect = ui.dialSvg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 320;
  const y = ((clientY - rect.top) / rect.height) * 320;
  const angle = Math.atan2(y - DIAL_CY, x - DIAL_CX);

  let minute = ((angle + Math.PI / 2) / (Math.PI * 2)) * 60;
  if (minute < 0) minute += 60;

  const rounded = Math.round(minute) % 60;
  return rounded === 0 ? 60 : rounded;
}

function applyWorkMinute(nextMinute) {
  const minute = Math.max(1, Math.min(60, nextMinute));
  state.workMinutes = minute;

  if (state.sessionType === "work") {
    state.remainingSeconds = state.workMinutes * 60;
  }

  render();
}

function setupDialInteraction() {
  if (!ui.dialHit || !ui.dialSvg) return;

  let dragging = false;
  const startDrag = (clientX, clientY) => {
    dragging = true;
    applyWorkMinute(minuteFromDialPointer(clientX, clientY));
  };

  const moveDrag = (clientX, clientY) => {
    if (!dragging) return;
    applyWorkMinute(minuteFromDialPointer(clientX, clientY));
  };

  const endDrag = () => {
    dragging = false;
  };

  // Pointer events (touch + pen + modern mouse)
  const pointerStart = (event) => {
    event.preventDefault();
    startDrag(event.clientX, event.clientY);
  };
  ui.dialHit.addEventListener("pointerdown", pointerStart);
  ui.dialSvg.addEventListener("pointerdown", pointerStart);

  const clickSet = (event) => {
    applyWorkMinute(minuteFromDialPointer(event.clientX, event.clientY));
  };
  ui.dialHit.addEventListener("click", clickSet);
  ui.dialSvg.addEventListener("click", clickSet);

  window.addEventListener("pointermove", (event) => {
    moveDrag(event.clientX, event.clientY);
  });

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // Explicit mouse events for desktop compatibility requirement
  const mouseStart = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    startDrag(event.clientX, event.clientY);
  };
  ui.dialHit.addEventListener("mousedown", mouseStart);
  ui.dialSvg.addEventListener("mousedown", mouseStart);

  window.addEventListener("mousemove", (event) => {
    moveDrag(event.clientX, event.clientY);
  });

  window.addEventListener("mouseup", endDrag);

  // Stop dragging when pointer leaves the viewport/window
  window.addEventListener("blur", endDrag);
  document.addEventListener("mouseleave", endDrag);
  window.addEventListener("mouseout", (event) => {
    if (!event.relatedTarget) endDrag();
  });
}

function setupSoundModal() {
  if (!ui.soundModal || !ui.soundOpenBtn || !ui.soundModalSelect) return;

  const openModal = () => {
    ui.soundModal.classList.remove("hidden");
    ui.soundModalSelect.value = state.soundPreset;
  };

  const closeModal = () => {
    ui.soundModal.classList.add("hidden");
  };

  ui.soundOpenBtn.addEventListener("click", openModal);
  ui.soundModalCloseBtn?.addEventListener("click", closeModal);
  ui.soundModalBackdrop?.addEventListener("click", closeModal);

  ui.soundModalSelect.addEventListener("change", (e) => {
    state.soundPreset = e.target.value;
    playPreset(state.soundPreset);
    render();
  });

  ui.soundModalPreviewBtn?.addEventListener("click", () => {
    playPreset(state.soundPreset);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !ui.soundModal.classList.contains("hidden")) {
      closeModal();
    }
  });
}

function ensureAudioContext() {
  if (!state.audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    state.audioCtx = new AudioCtx();
  }
  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume().catch(() => {});
  }
}

function playBellTone(freq, start, duration, gainNode) {
  const ctx = state.audioCtx;
  const oscMain = ctx.createOscillator();
  const oscHarm = ctx.createOscillator();
  const toneGain = ctx.createGain();

  oscMain.type = "sine";
  oscHarm.type = "triangle";

  oscMain.frequency.setValueAtTime(freq, start);
  oscHarm.frequency.setValueAtTime(freq * 2, start);

  toneGain.gain.setValueAtTime(0.0001, start);
  toneGain.gain.linearRampToValueAtTime(0.12, start + 0.02);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscMain.connect(toneGain);
  oscHarm.connect(toneGain);
  toneGain.connect(gainNode);

  oscMain.start(start);
  oscHarm.start(start);
  oscMain.stop(start + duration);
  oscHarm.stop(start + duration);
}

function playPreset(name) {
  ensureAudioContext();
  if (!state.audioCtx) return;

  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  const preset = SOUND_PRESETS[name] || SOUND_PRESETS.chime;

  const master = ctx.createGain();
  master.gain.value = preset.gain;

  const delay = ctx.createDelay();
  delay.delayTime.value = preset.delayTime;

  const feedback = ctx.createGain();
  feedback.gain.value = preset.feedback;

  const wet = ctx.createGain();
  wet.gain.value = preset.wet;

  master.connect(ctx.destination);
  master.connect(delay);
  delay.connect(wet);
  wet.connect(ctx.destination);
  delay.connect(feedback);
  feedback.connect(delay);

  for (const tone of preset.tones) {
    playBellTone(tone.freq, now + tone.offset, tone.duration, master);
  }

  setTimeout(() => {
    delay.disconnect();
    feedback.disconnect();
    wet.disconnect();
    master.disconnect();
  }, 1900);
}

function switchSession() {
  const nextSession = state.sessionType === "work" ? "rest" : "work";

  if (state.sessionType === "work") {
    state.completedWorkSessions += 1;
  }

  state.sessionType = nextSession;
  state.remainingSeconds = totalSecondsForCurrentSession();

  if (nextSession === "rest") {
    // 집중 종료 -> 휴식 시작: 경쾌한 전용 사운드
    playPreset("upbeat");
  } else {
    // 휴식 종료 -> 집중 시작: 사용자가 고른 사운드
    playPreset(state.soundPreset);
  }
}

function tick() {
  if (!state.isRunning) return;

  if (state.remainingSeconds > 0) {
    state.remainingSeconds -= 1;
  } else {
    switchSession();
  }

  render();
}

function start() {
  if (state.isRunning) return;
  ensureAudioContext();
  state.isRunning = true;
  state.timerId = window.setInterval(tick, 1000);
  render();
}

function pause() {
  state.isRunning = false;
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  render();
}

function stop() {
  pause();
  state.sessionType = "work";
  state.remainingSeconds = state.workMinutes * 60;
  state.completedWorkSessions = 0;
  render();
}

ui.startPauseBtn.addEventListener("click", () => {
  if (state.isRunning) {
    pause();
  } else {
    start();
  }
});

ui.stopBtn.addEventListener("click", stop);

ui.workRange.addEventListener("input", (e) => {
  state.workMinutes = Number(e.target.value);
  if (!state.isRunning && state.sessionType === "work") {
    state.remainingSeconds = state.workMinutes * 60;
  }
  render();
});

ui.restRange.addEventListener("input", (e) => {
  state.restMinutes = Number(e.target.value);
  if (!state.isRunning && state.sessionType === "rest") {
    state.remainingSeconds = state.restMinutes * 60;
  }
  render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

initDialFace();
setupDialInteraction();
setupSoundModal();
render();
