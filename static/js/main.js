(() => {
  'use strict';

  // ---------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------
  const screens = {
    lobby: document.getElementById('lobbyScreen'),
    wait: document.getElementById('waitScreen'),
    game: document.getElementById('gameScreen'),
  };
  const el = (id) => document.getElementById(id);
  const toastHost = el('toastHost');

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  // Small inline icon set used for toasts (no emoji anywhere)
  const ICONS = {
    success: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };

  function toast(message, kind) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ` toast-${kind}` : '');
    t.innerHTML = (ICONS[kind || 'info'] || '') + `<span>${message}</span>`;
    toastHost.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---------------------------------------------------------------
  // Status banner (non-blocking — never dims or covers the board)
  // ---------------------------------------------------------------
  function showBanner(text, isError) {
    const banner = el('statusBanner');
    el('statusBannerText').textContent = text;
    banner.classList.toggle('error', !!isError);
    banner.classList.remove('hidden');
  }
  function hideBanner() {
    el('statusBanner').classList.add('hidden');
  }

  // ---------------------------------------------------------------
  // Lobby tabs
  // ---------------------------------------------------------------
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      el(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });

  el('vsAiCheck').addEventListener('change', (e) => {
    el('aiDiffRow').classList.toggle('hidden', !e.target.checked);
    el('nameGRow').classList.toggle('hidden', e.target.checked);
    el('colorGRow').classList.toggle('hidden', e.target.checked);
  });

  // ---------------------------------------------------------------
  // Color swatch pickers
  // ---------------------------------------------------------------
  const chosenColors = {
    create: '#FF416C',
    join: '#2193B0',
    localS: '#FF416C',
    localG: '#2193B0',
  };

  function wireSwatchGroup(groupId, key) {
    const group = el(groupId);
    group.querySelectorAll('.swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        group.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        chosenColors[key] = sw.dataset.color;
      });
    });
  }
  wireSwatchGroup('colorPickerCreate', 'create');
  wireSwatchGroup('colorPickerJoin', 'join');
  wireSwatchGroup('colorPickerLocalS', 'localS');
  wireSwatchGroup('colorPickerLocalG', 'localG');

  function applyColorVars(colorS, colorG) {
    document.documentElement.style.setProperty('--color-S', colorS);
    document.documentElement.style.setProperty('--color-G', colorG);
  }

  // ---------------------------------------------------------------
  // Shared SVG board renderer
  // ---------------------------------------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VB = 800;
  let boardEls = null;

  function buildBoard(svg, size) {
    svg.innerHTML = '';
    const spacing = VB / (size + 1);
    const lineMap = new Map();
    const boxMap = new Map();

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const dx = spacing + x * spacing, dy = spacing + y * spacing;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', dx + 4);
        rect.setAttribute('y', dy + 4);
        rect.setAttribute('width', spacing - 8);
        rect.setAttribute('height', spacing - 8);
        rect.setAttribute('rx', 6);
        rect.setAttribute('class', 'box-fill');
        rect.setAttribute('fill', 'transparent');
        svg.appendChild(rect);

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', dx + spacing / 2);
        text.setAttribute('y', dy + spacing / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', Math.max(16, spacing / 2.6));
        text.setAttribute('class', 'box-label');
        text.setAttribute('fill', 'transparent');
        svg.appendChild(text);

        boxMap.set(`${x},${y}`, { rect, text });
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size - 1; x++) {
        const dx = spacing + x * spacing, dy = spacing + y * spacing;
        addLine(svg, lineMap, x, y, 'h', dx, dy, dx + spacing, dy);
      }
    }
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size; x++) {
        const dx = spacing + x * spacing, dy = spacing + y * spacing;
        addLine(svg, lineMap, x, y, 'v', dx, dy, dx, dy + spacing);
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = spacing + x * spacing, dy = spacing + y * spacing;
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', dx); c.setAttribute('cy', dy); c.setAttribute('r', 7);
        c.setAttribute('class', 'dot');
        svg.appendChild(c);
        const h = document.createElementNS(SVG_NS, 'circle');
        h.setAttribute('cx', dx - 2); h.setAttribute('cy', dy - 2); h.setAttribute('r', 2.4);
        h.setAttribute('class', 'dot-highlight');
        svg.appendChild(h);
      }
    }

    boardEls = { lines: lineMap, boxes: boxMap, size, spacing };
  }

  function addLine(svg, lineMap, x, y, type, x1, y1, x2, y2) {
    const hit = document.createElementNS(SVG_NS, 'line');
    hit.setAttribute('x1', x1); hit.setAttribute('y1', y1);
    hit.setAttribute('x2', x2); hit.setAttribute('y2', y2);
    hit.setAttribute('class', 'line-hit');
    svg.appendChild(hit);

    const visible = document.createElementNS(SVG_NS, 'line');
    visible.setAttribute('x1', x1); visible.setAttribute('y1', y1);
    visible.setAttribute('x2', x2); visible.setAttribute('y2', y2);
    visible.setAttribute('class', 'line-visible');
    svg.appendChild(visible);

    hit.addEventListener('click', () => onLineTap(x, y, type));
    lineMap.set(`${x},${y},${type}`, { hit, visible });
  }

  let onLineTap = () => {};

  function renderState(state) {
    if (state.colors) applyColorVars(state.colors.S, state.colors.G);

    if (!boardEls || boardEls.size !== state.size) {
      buildBoard(el('board'), state.size);
    }

    const lastMove = state.lastMove || state.last_move || null;
    const lastKey = lastMove ? `${lastMove.x},${lastMove.y},${lastMove.type}` : null;

    for (const [key, { hit, visible }] of boardEls.lines) {
      const owner = state.lines[key];
      if (owner) {
        let cls = `line-visible owner-${owner}`;
        if (key === lastKey) cls += ' last-move';
        visible.setAttribute('class', cls);
        hit.setAttribute('class', 'line-hit taken');
      } else {
        visible.setAttribute('class', 'line-visible');
        hit.setAttribute('class', 'line-hit');
      }
    }

    for (const [key, { rect, text }] of boardEls.boxes) {
      const owner = state.boxes[key];
      if (owner) {
        rect.setAttribute('fill', owner === 'S'
          ? 'color-mix(in srgb, var(--color-S) 14%, white)'
          : 'color-mix(in srgb, var(--color-G) 14%, white)');
        text.setAttribute('fill', owner === 'S' ? 'var(--color-S)' : 'var(--color-G)');
        text.textContent = (state.names[owner] || owner).charAt(0).toUpperCase();
      } else {
        rect.setAttribute('fill', 'transparent');
        text.setAttribute('fill', 'transparent');
        text.textContent = '';
      }
    }

    el('nameSLabel').textContent = state.names.S || 'Player 1';
    el('nameGLabel').textContent = state.names.G || 'Player 2';
    el('scoreSNum').textContent = state.score.S;
    el('scoreGNum').textContent = state.score.G;
    el('scoreS').classList.toggle('active-turn', state.turn === 'S' && !state.game_over);
    el('scoreG').classList.toggle('active-turn', state.turn === 'G' && !state.game_over);
  }

  // ---------------------------------------------------------------
  // Winner modal
  // ---------------------------------------------------------------
  function showWinner(state) {
    const title = el('winnerTitle');
    const stats = el('winnerStats');
    let text;
    if (state.score.S > state.score.G) text = `${state.names.S} wins!`;
    else if (state.score.G > state.score.S) text = `${state.names.G} wins!`;
    else text = "It's a draw!";
    title.textContent = text;
    stats.innerHTML = `
      <div><span class="dot-inline" style="background:${state.colors ? state.colors.S : 'var(--color-S)'}"></span>${state.names.S}: <strong>${state.score.S}</strong> boxes</div>
      <div><span class="dot-inline" style="background:${state.colors ? state.colors.G : 'var(--color-G)'}"></span>${state.names.G}: <strong>${state.score.G}</strong> boxes</div>`;
    el('winnerOverlay').classList.remove('hidden');
  }
  el('winnerCloseBtn').addEventListener('click', () => el('winnerOverlay').classList.add('hidden'));

  // =================================================================
  // LOCAL MODE
  // =================================================================
  let localState = null;
  let localHistory = [];
  let localVsAi = false;
  let localAiThinking = false;

  function newLocalGame() {
    const size = parseInt(el('boardSizeLocal').value, 10);
    localVsAi = el('vsAiCheck').checked;
    const nameS = (el('playerName').value || 'Player 1').trim() || 'Player 1';
    const nameG = localVsAi ? 'Computer' : ((el('nameG_local').value || 'Player 2').trim() || 'Player 2');
    const colorS = chosenColors.localS;
    const colorG = localVsAi ? '#8E44AD' : chosenColors.localG;

    localState = {
      size, lines: {}, boxes: {}, score: { S: 0, G: 0 }, turn: 'S',
      names: { S: nameS, G: nameG }, colors: { S: colorS, G: colorG },
      lastMove: null, game_over: false,
    };
    localHistory = [];
    boardEls = null;
    el('modeChip').textContent = localVsAi ? 'Same device · vs Computer' : 'Same device · 2 Player';
    el('connStatus').classList.add('hidden');
    el('leaveOnlineBtn').classList.add('hidden');
    el('newLocalBtn').classList.remove('hidden');
    el('undoBtn').classList.remove('hidden');
    el('voiceToggleBtn').classList.add('hidden');
    el('muteToggleBtn').classList.add('hidden');
    el('musicToggleBtn').classList.toggle('hidden', !localVsAi);
    if (!localVsAi && window.MusicEngine.isPlaying()) {
      window.MusicEngine.stop();
      el('musicToggleBtn').classList.remove('active');
      el('musicToggleLabel').textContent = 'Play Music';
    }
    disableVoice(false);
    hideBanner();
    showScreen('game');
    onLineTap = localLineTap;
    renderState(localState);
  }

  function snapshotLocal() {
    localHistory.push(JSON.parse(JSON.stringify({
      lines: localState.lines, boxes: localState.boxes, score: localState.score,
      turn: localState.turn, lastMove: localState.lastMove,
    })));
    if (localHistory.length > 60) localHistory.shift();
  }

  function localCheckBox(x, y, turn) {
    const size = localState.size;
    if (x < 0 || y < 0 || x >= size - 1 || y >= size - 1) return false;
    const top = `${x},${y},h`, bottom = `${x},${y + 1},h`, left = `${x},${y},v`, right = `${x + 1},${y},v`;
    if (localState.lines[top] && localState.lines[bottom] && localState.lines[left] && localState.lines[right]) {
      const key = `${x},${y}`;
      if (!localState.boxes[key]) {
        localState.boxes[key] = turn;
        localState.score[turn]++;
        return true;
      }
    }
    return false;
  }

  function localApplyMove(x, y, type) {
    const key = `${x},${y},${type}`;
    if (localState.lines[key] || localState.game_over) return false;
    snapshotLocal();
    const turn = localState.turn;
    localState.lines[key] = turn;
    localState.lastMove = { x, y, type };

    let madeBox = false;
    const size = localState.size;
    if (type === 'h') {
      if (y > 0) madeBox = localCheckBox(x, y - 1, turn) || madeBox;
      if (y < size - 1) madeBox = localCheckBox(x, y, turn) || madeBox;
    } else {
      if (x > 0) madeBox = localCheckBox(x - 1, y, turn) || madeBox;
      if (x < size - 1) madeBox = localCheckBox(x, y, turn) || madeBox;
    }
    if (!madeBox) localState.turn = turn === 'S' ? 'G' : 'S';

    const total = (size - 1) * (size - 1);
    if (Object.keys(localState.boxes).length >= total) localState.game_over = true;

    renderState(localState);
    if (localState.game_over) { setTimeout(() => showWinner(localState), 300); return true; }
    return true;
  }

  function localLineTap(x, y, type) {
    if (localState.game_over) return;
    if (localVsAi && localState.turn === 'G') return;
    if (localApplyMove(x, y, type) && localVsAi && localState.turn === 'G' && !localState.game_over) {
      setTimeout(runAiMove, 350);
    }
  }

  // ---- local AI ----
  function availableMoves() {
    const moves = [];
    const size = localState.size;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size - 1; x++)
        if (!localState.lines[`${x},${y},h`]) moves.push({ x, y, type: 'h' });
    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size; x++)
        if (!localState.lines[`${x},${y},v`]) moves.push({ x, y, type: 'v' });
    return moves;
  }

  function boxesTouchedBy(m) {
    const size = localState.size, list = [];
    if (m.type === 'h') {
      if (m.y > 0) list.push([m.x, m.y - 1]);
      if (m.y < size - 1) list.push([m.x, m.y]);
    } else {
      if (m.x > 0) list.push([m.x - 1, m.y]);
      if (m.x < size - 1) list.push([m.x, m.y]);
    }
    return list;
  }

  function sidesFilled(x, y, extraKey) {
    const top = `${x},${y},h`, bottom = `${x},${y + 1},h`, left = `${x},${y},v`, right = `${x + 1},${y},v`;
    let c = 0;
    if (localState.lines[top] || top === extraKey) c++;
    if (localState.lines[bottom] || bottom === extraKey) c++;
    if (localState.lines[left] || left === extraKey) c++;
    if (localState.lines[right] || right === extraKey) c++;
    return c;
  }

  function movesCompleted(m) {
    const key = `${m.x},${m.y},${m.type}`;
    let c = 0;
    for (const [bx, by] of boxesTouchedBy(m)) {
      if (!localState.boxes[`${bx},${by}`] && sidesFilled(bx, by, key) === 4) c++;
    }
    return c;
  }

  function givesAwayBox(m) {
    const key = `${m.x},${m.y},${m.type}`;
    for (const [bx, by] of boxesTouchedBy(m)) {
      if (!localState.boxes[`${bx},${by}`] && sidesFilled(bx, by, key) === 3) return true;
    }
    return false;
  }

  function runAiMove() {
    if (localState.game_over || !localVsAi || localState.turn !== 'G' || localAiThinking) return;
    localAiThinking = true;
    showBanner('Computer is thinking…');

    setTimeout(() => {
      const difficulty = el('aiDifficulty').value;
      const moves = availableMoves();
      if (moves.length === 0) { localAiThinking = false; hideBanner(); return; }

      let chosen;
      if (difficulty === 'easy') {
        const completing = moves.filter(m => movesCompleted(m) > 0);
        chosen = (completing.length && Math.random() < 0.6)
          ? completing[Math.floor(Math.random() * completing.length)]
          : moves[Math.floor(Math.random() * moves.length)];
      } else {
        const completing = moves.map(m => ({ m, c: movesCompleted(m) })).filter(o => o.c > 0).sort((a, b) => b.c - a.c);
        if (completing.length) {
          chosen = completing[0].m;
        } else {
          const safe = moves.filter(m => !givesAwayBox(m));
          if (safe.length) {
            if (difficulty === 'hard') {
              let bestScore = -Infinity, cands = [];
              for (const m of safe) {
                const key = `${m.x},${m.y},${m.type}`;
                localState.lines[key] = 'G';
                const remain = availableMoves().filter(mm => !givesAwayBox(mm)).length;
                delete localState.lines[key];
                if (remain > bestScore) { bestScore = remain; cands = [m]; }
                else if (remain === bestScore) cands.push(m);
              }
              chosen = cands[Math.floor(Math.random() * cands.length)];
            } else {
              chosen = safe[Math.floor(Math.random() * safe.length)];
            }
          } else {
            const scored = moves.map(m => {
              let minChain = 4;
              for (const [bx, by] of boxesTouchedBy(m)) {
                if (!localState.boxes[`${bx},${by}`]) {
                  const s = sidesFilled(bx, by, `${m.x},${m.y},${m.type}`);
                  if (s < minChain) minChain = s;
                }
              }
              return { m, minChain };
            }).sort((a, b) => a.minChain - b.minChain);
            chosen = scored[0].m;
          }
        }
      }

      localApplyMove(chosen.x, chosen.y, chosen.type);
      localAiThinking = false;
      hideBanner();
      if (localVsAi && localState.turn === 'G' && !localState.game_over) {
        setTimeout(runAiMove, 350);
      }
    }, 450);
  }

  el('startLocalBtn').addEventListener('click', newLocalGame);
  el('newLocalBtn').addEventListener('click', newLocalGame);
  el('undoBtn').addEventListener('click', () => {
    if (!localState || localHistory.length === 0 || localState.game_over) return;
    const prev = localHistory.pop();
    localState.lines = prev.lines; localState.boxes = prev.boxes;
    localState.score = prev.score; localState.turn = prev.turn; localState.lastMove = prev.lastMove;
    renderState(localState);
  });

  // =================================================================
  // ONLINE MODE
  // =================================================================
  let socket = null;
  let onlineCode = null;
  let onlineRole = null;
  let onlineState = null;

  // ---- Voice chat (WebRTC, peer-to-peer — audio never touches the server) ----
  const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  let localStream = null;
  let peerConnection = null;
  let voiceConnected = false;
  let voiceReadySentByMe = false;
  let opponentVoiceReady = false;
  let micMuted = false;

  function updateVoiceUI() {
    const voiceBtn = el('voiceToggleBtn');
    const muteBtn = el('muteToggleBtn');
    voiceBtn.classList.toggle('active', voiceConnected);
    el('voiceToggleLabel').textContent = voiceConnected ? 'Leave Voice' : 'Voice Chat';
    muteBtn.classList.toggle('hidden', !voiceConnected);
    muteBtn.classList.toggle('active', voiceConnected);
    muteBtn.classList.toggle('muted', micMuted);
    el('muteToggleLabel').textContent = micMuted ? 'Unmute' : 'Mute';
  }

  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) socket.emit('voice_ice', { code: onlineCode, candidate: e.candidate });
    };
    peerConnection.ontrack = (e) => {
      const audioEl = el('remoteAudio');
      audioEl.srcObject = e.streams[0];
      audioEl.play().catch(() => {});
      hideBanner();
      toast('Voice chat connected', 'success');
    };
  }

  function maybeInitiateOffer() {
    if (onlineRole === 'S' && voiceReadySentByMe && opponentVoiceReady && peerConnection) {
      createAndSendOffer();
    }
  }

  async function createAndSendOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('voice_offer', { code: onlineCode, sdp: peerConnection.localDescription });
  }

  async function enableVoice() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      toast('Microphone access was denied', 'error');
      return;
    }
    createPeerConnection();
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    voiceConnected = true;
    micMuted = false;
    updateVoiceUI();
    showBanner('Connecting voice…');
    voiceReadySentByMe = true;
    ensureSocket().emit('voice_ready', { code: onlineCode });
    maybeInitiateOffer();
  }

  function disableVoice(notifyOpponent) {
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    voiceConnected = false;
    voiceReadySentByMe = false;
    opponentVoiceReady = false;
    micMuted = false;
    el('remoteAudio').srcObject = null;
    updateVoiceUI();
    hideBanner();
    if (notifyOpponent && onlineCode && socket) socket.emit('voice_leave', { code: onlineCode });
  }

  function toggleMute() {
    if (!localStream) return;
    micMuted = !micMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !micMuted; });
    updateVoiceUI();
  }

  el('voiceToggleBtn').addEventListener('click', () => {
    if (voiceConnected) disableVoice(true); else enableVoice();
  });
  el('muteToggleBtn').addEventListener('click', toggleMute);

  // ---- Background music (vs-computer local games only) ----
  el('musicToggleBtn').addEventListener('click', () => {
    if (window.MusicEngine.isPlaying()) {
      window.MusicEngine.stop();
      el('musicToggleBtn').classList.remove('active');
      el('musicToggleLabel').textContent = 'Play Music';
    } else {
      window.MusicEngine.play();
      el('musicToggleBtn').classList.add('active');
      el('musicToggleLabel').textContent = 'Stop Music';
    }
  });

  function ensureSocket() {
    if (socket) return socket;
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => setConnStatus(true));
    socket.on('disconnect', () => setConnStatus(false));

    socket.on('room_created', (data) => {
      onlineCode = data.code; onlineRole = data.role; onlineState = data.state;
      el('roomCodeText').textContent = onlineCode;
      showScreen('wait');
    });

    socket.on('join_error', (data) => {
      el('joinError').textContent = data.message;
      el('joinRoomBtn').disabled = false;
    });

    socket.on('room_joined', (data) => {
      onlineCode = data.code; onlineRole = data.role; onlineState = data.state;
    });

    socket.on('opponent_joined', () => toast('Opponent joined the room', 'success'));

    socket.on('game_start', (data) => {
      onlineState = data.state;
      startOnlineGameScreen();
    });

    socket.on('state_update', (data) => {
      onlineState = data.state;
      renderState(onlineState);
      if (onlineState.game_over) setTimeout(() => showWinner(onlineState), 300);
    });

    socket.on('opponent_left', (data) => {
      onlineState = data.state;
      toast('Opponent disconnected', 'error');
      if (!screens.game.classList.contains('hidden')) {
        showBanner('Opponent disconnected — waiting for them to reconnect', true);
      }
      disableVoice(false);
    });

    socket.on('voice_ready', () => {
      opponentVoiceReady = true;
      maybeInitiateOffer();
    });

    socket.on('voice_offer', async (data) => {
      if (!peerConnection) return; // we haven't opted in to voice
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('voice_answer', { code: onlineCode, sdp: peerConnection.localDescription });
    });

    socket.on('voice_answer', async (data) => {
      if (!peerConnection) return;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    });

    socket.on('voice_ice', async (data) => {
      if (!peerConnection) return;
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); }
      catch (e) { /* candidate arrived after close — safe to ignore */ }
    });

    socket.on('voice_leave', () => {
      toast('Opponent left voice chat', 'info');
      disableVoice(false);
    });

    return socket;
  }

  function setConnStatus(ok) {
    const dot = el('connDot'), text = el('connText');
    dot.classList.toggle('offline', !ok);
    text.textContent = ok ? 'Connected' : 'Reconnecting…';
  }

  function startOnlineGameScreen() {
    boardEls = null;
    el('modeChip').textContent = `Online · Room ${onlineCode}`;
    el('connStatus').classList.remove('hidden');
    el('leaveOnlineBtn').classList.remove('hidden');
    el('undoBtn').classList.add('hidden');
    el('newLocalBtn').classList.add('hidden');
    el('musicToggleBtn').classList.add('hidden');
    el('voiceToggleBtn').classList.remove('hidden');
    if (window.MusicEngine.isPlaying()) {
      window.MusicEngine.stop();
      el('musicToggleLabel').textContent = 'Play Music';
    }
    updateVoiceUI();
    hideBanner();
    showScreen('game');
    onLineTap = onlineLineTap;
    renderState(onlineState);
  }

  function onlineLineTap(x, y, type) {
    if (!onlineState || onlineState.game_over) return;
    if (onlineState.turn !== onlineRole) { toast("It's not your turn", 'error'); return; }
    socket.emit('make_move', { code: onlineCode, x, y, type });
  }

  el('createRoomBtn').addEventListener('click', () => {
    const name = el('playerName').value;
    const size = el('boardSizeCreate').value;
    const color = chosenColors.create;
    ensureSocket().emit('create_room', { name, size, color });
  });

  el('joinRoomBtn').addEventListener('click', () => {
    const code = el('joinCodeInput').value.trim().toUpperCase();
    if (code.length < 4) { el('joinError').textContent = 'Enter a valid room code.'; return; }
    el('joinError').textContent = '';
    el('joinRoomBtn').disabled = true;
    const name = el('playerName').value;
    const color = chosenColors.join;
    ensureSocket().emit('join_room_req', { code, name, color });
  });

  el('roomCodeBtn').addEventListener('click', () => {
    if (!onlineCode) return;
    navigator.clipboard?.writeText(onlineCode).then(() => toast('Code copied', 'success'));
  });

  el('cancelWaitBtn').addEventListener('click', () => {
    if (socket && onlineCode) socket.emit('leave_room_req', { code: onlineCode });
    onlineCode = null;
    showScreen('lobby');
  });

  el('leaveOnlineBtn').addEventListener('click', () => {
    disableVoice(true);
    if (socket && onlineCode) socket.emit('leave_room_req', { code: onlineCode });
    onlineCode = null; onlineState = null;
    showScreen('lobby');
  });

  el('backBtn').addEventListener('click', () => {
    disableVoice(true);
    if (window.MusicEngine.isPlaying()) window.MusicEngine.stop();
    if (onlineCode && socket) socket.emit('leave_room_req', { code: onlineCode });
    onlineCode = null;
    el('winnerOverlay').classList.add('hidden');
    showScreen('lobby');
  });

  el('joinCodeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') el('joinRoomBtn').click(); });
  el('playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
})();
