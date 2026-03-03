(function () {
  'use strict';

  var canvas = document.getElementById('spectral-canvas');
  if (!canvas) return;

  var SPECTRAL_BASE = (document.querySelector('meta[name="spectral-base-url"]') || {}).content || 'data/';
  var AUDIO_BASE = (document.querySelector('meta[name="audio-base-url"]') || {}).content || 'audio/';

  var TRACKS = [
    {
      title: 'Berghain',
      artist: 'ROSAL\u00cdA',
      audioFile: 'berghain.mp3',
      dataFile: 'spectral_data.json',
      ringColor: '#87ceeb',
      theme: 'blue',
      colors: {
        deep: [0.05, 0.08, 0.18],
        mid:  [0.1, 0.5, 0.7],
        bright: [0.85, 0.95, 1.0]
      }
    },
    {
      title: 'Fever',
      artist: 'Dua Lipa',
      audioFile: 'fever.mp3',
      dataFile: 'spectral_fever.json',
      ringColor: '#ff4455',
      theme: 'red',
      colors: {
        deep: [0.18, 0.04, 0.06],
        mid:  [0.7, 0.12, 0.15],
        bright: [1.0, 0.75, 0.7]
      }
    }
  ];

  var currentTrackIdx = 0;
  var scene, camera, renderer, mesh, clock;
  var spectralData = null;
  var currentPositionMs = 0;
  var isPlaying = false;
  var idleReady = false;

  var VISIBLE_SECONDS = 10;
  var TERRAIN_WIDTH = 20;
  var TERRAIN_DEPTH = 10;
  var HEIGHT_SCALE = 3.0;
  var LERP_SPEED = 6.0;

  var freqSegs, timeSegs;
  var targetHeights = null;
  var currentHeights = null;

  var audio = document.getElementById('hero-audio');
  var playBtn = document.getElementById('hero-play-btn');
  var nextBtn = document.getElementById('hero-next-btn');
  var timeDisplay = document.getElementById('hero-time');
  var playHint = document.getElementById('hero-play-hint');
  var btnRing = document.getElementById('hero-btn-ring');
  var trackTitle = document.getElementById('hero-track-title');
  var trackArtist = document.getElementById('hero-track-artist');
  var playerEl = document.getElementById('hero-player');

  var spectralCache = {};

  function init() {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2332);
    scene.fog = new THREE.FogExp2(0x1a2332, 0.035);

    camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 6, 8);
    camera.lookAt(0, 0, -2);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene.add(new THREE.AmbientLight(0x334466, 0.6));
    var dirLight = new THREE.DirectionalLight(0xaaccff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    window.addEventListener('resize', onResize);

    loadTrack(currentTrackIdx);
    initAudioPlayer();
    animate();
  }

  function onResize() {
    var w = canvas.parentElement.clientWidth;
    var h = canvas.parentElement.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function loadTrack(idx) {
    var track = TRACKS[idx];
    currentTrackIdx = idx;

    if (trackTitle) trackTitle.textContent = track.title;
    if (trackArtist) trackArtist.textContent = track.artist;
    if (btnRing) {
      btnRing.style.setProperty('--ring-color', track.ringColor);
      btnRing.style.setProperty('--progress', 0);
    }
    if (timeDisplay) timeDisplay.textContent = '0:00';
    if (playerEl) playerEl.setAttribute('data-theme', track.theme);

    audio.src = AUDIO_BASE + track.audioFile;
    audio.load();

    var dataUrl = SPECTRAL_BASE + track.dataFile;
    if (spectralCache[dataUrl]) {
      spectralData = spectralCache[dataUrl];
      rebuildTerrain();
    } else {
      fetch(dataUrl)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          spectralCache[dataUrl] = data;
          spectralData = data;
          rebuildTerrain();
        })
        .catch(function (err) {
          console.error('Failed to load spectral data:', err);
        });
    }
  }

  function makeFragmentShader(colors) {
    var d = colors.deep, m = colors.mid, b = colors.bright;
    return [
      'varying float vHeight;',
      'varying vec2 vUv;',
      'void main() {',
      '  float h = clamp(vHeight / ' + HEIGHT_SCALE.toFixed(1) + ', 0.0, 1.0);',
      '  vec3 deepC = vec3(' + d[0].toFixed(3) + ', ' + d[1].toFixed(3) + ', ' + d[2].toFixed(3) + ');',
      '  vec3 midC  = vec3(' + m[0].toFixed(3) + ', ' + m[1].toFixed(3) + ', ' + m[2].toFixed(3) + ');',
      '  vec3 brightC = vec3(' + b[0].toFixed(3) + ', ' + b[1].toFixed(3) + ', ' + b[2].toFixed(3) + ');',
      '  vec3 color = h < 0.5',
      '    ? mix(deepC, midC, h * 2.0)',
      '    : mix(midC, brightC, (h - 0.5) * 2.0);',
      '  float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);',
      '  gl_FragColor = vec4(color * (0.4 + 0.6 * edge), 1.0);',
      '}'
    ].join('\n');
  }

  var vertexShader = [
    'varying float vHeight;',
    'varying vec2 vUv;',
    'void main() {',
    '  vHeight = position.y;',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  function rebuildTerrain() {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    freqSegs = spectralData.nMels - 1;
    timeSegs = Math.min(Math.floor(VISIBLE_SECONDS * spectralData.fps), 240);

    var geometry = new THREE.PlaneGeometry(TERRAIN_WIDTH, TERRAIN_DEPTH, timeSegs, freqSegs);
    geometry.rotateX(-Math.PI / 2);

    var vertCount = (timeSegs + 1) * (freqSegs + 1);
    targetHeights = new Float32Array(vertCount);
    currentHeights = new Float32Array(vertCount);

    var track = TRACKS[currentTrackIdx];
    var fragShader = makeFragmentShader(track.colors);

    mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragShader,
      side: THREE.DoubleSide
    }));
    scene.add(mesh);

    var midMs = (spectralData.duration * 1000) * 0.4;
    computeTargetHeights(midMs);
    for (var i = 0; i < vertCount; i++) {
      currentHeights[i] = targetHeights[i];
    }
    applyHeights(currentHeights);
    mesh.geometry.computeVertexNormals();
    idleReady = true;
  }

  function sampleAmplitude(frameIdx, freqIdx, totalFrames) {
    if (frameIdx < 0 || frameIdx >= totalFrames) return 0;
    var frame = spectralData.frames[frameIdx];
    if (!frame) return 0;
    return frame[Math.min(freqIdx, spectralData.nMels - 1)] || 0;
  }

  function computeTargetHeights(positionMs) {
    if (!spectralData) return;

    var fps = spectralData.fps;
    var totalFrames = spectralData.nFrames;
    var exactFrame = (positionMs / 1000) * fps;
    var frameA = Math.floor(exactFrame);
    var frameB = frameA + 1;
    var t = exactFrame - frameA;

    var cols = timeSegs + 1;
    var rows = freqSegs + 1;
    var halfWindow = Math.floor(timeSegs / 2);
    var startA = frameA - halfWindow;
    var startB = frameB - halfWindow;

    for (var col = 0; col < cols; col++) {
      var fA = startA + col;
      var fB = startB + col;
      for (var row = 0; row < rows; row++) {
        var idx = row * cols + col;
        var freqIdx = Math.min(row, spectralData.nMels - 1);
        var ampA = sampleAmplitude(fA, freqIdx, totalFrames);
        var ampB = sampleAmplitude(fB, freqIdx, totalFrames);
        targetHeights[idx] = (ampA + (ampB - ampA) * t) * HEIGHT_SCALE;
      }
    }
  }

  function applyHeights(heights) {
    var positions = mesh.geometry.attributes.position.array;
    var count = heights.length;
    for (var i = 0; i < count; i++) {
      positions[i * 3 + 1] = heights[i];
    }
    mesh.geometry.attributes.position.needsUpdate = true;
  }

  function lerpHeights(dt) {
    var factor = 1 - Math.exp(-LERP_SPEED * dt);
    var count = currentHeights.length;
    var changed = false;
    for (var i = 0; i < count; i++) {
      var cur = currentHeights[i];
      var tgt = targetHeights[i];
      if (cur !== tgt) {
        currentHeights[i] = cur + (tgt - cur) * factor;
        changed = true;
      }
    }
    return changed;
  }

  var normalTimer = 0;
  var NORMAL_INTERVAL = 0.1;
  var zoomFactor = 0;
  var ZOOM_SPEED = 2.5;

  function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !scene || !camera || !spectralData || !mesh) {
      if (renderer && scene && camera) renderer.render(scene, camera);
      return;
    }

    var dt = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.getElapsedTime();

    var zoomTarget = isPlaying ? 1 : 0;
    zoomFactor += (zoomTarget - zoomFactor) * (1 - Math.exp(-ZOOM_SPEED * dt));

    if (isPlaying && audio) {
      currentPositionMs = audio.currentTime * 1000;
      computeTargetHeights(currentPositionMs);
    } else if (!idleReady) {
      var midMs = (spectralData.duration * 1000) * 0.4;
      computeTargetHeights(midMs);
      for (var i = 0; i < currentHeights.length; i++) {
        currentHeights[i] = targetHeights[i];
      }
      applyHeights(currentHeights);
      mesh.geometry.computeVertexNormals();
      idleReady = true;
    }

    if (isPlaying) {
      var changed = lerpHeights(dt);
      if (changed) {
        applyHeights(currentHeights);
        normalTimer += dt;
        if (normalTimer >= NORMAL_INTERVAL) {
          mesh.geometry.computeVertexNormals();
          normalTimer = 0;
        }
      }
    }

    var idleX = Math.sin(elapsed * 0.08) * 2.5;
    var idleY = 6 + Math.sin(elapsed * 0.05) * 1.5;
    var idleZ = 10 + Math.cos(elapsed * 0.06) * 2.0;

    var playX = Math.sin(elapsed * 0.06) * 0.5;
    var playY = 4.5 + Math.sin(elapsed * 0.09) * 0.3;
    var playZ = 6;

    camera.position.x = idleX + (playX - idleX) * zoomFactor;
    camera.position.y = idleY + (playY - idleY) * zoomFactor;
    camera.position.z = idleZ + (playZ - idleZ) * zoomFactor;
    camera.lookAt(0, 0.5, -2);

    renderer.render(scene, camera);
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updatePlayerUI() {
    var playIcon = playBtn.querySelector('.play-icon');
    var pauseIcon = playBtn.querySelector('.pause-icon');
    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = '';
    } else {
      playIcon.style.display = '';
      pauseIcon.style.display = 'none';
    }
  }

  function switchTrack(idx) {
    var wasPlaying = isPlaying;
    audio.pause();
    isPlaying = false;
    idleReady = false;
    loadTrack(idx);
    if (wasPlaying) {
      audio.addEventListener('canplay', function onCanPlay() {
        audio.removeEventListener('canplay', onCanPlay);
        audio.play();
      });
    }
  }

  function initAudioPlayer() {
    if (!audio || !playBtn) return;

    loadTrack(0);

    playBtn.addEventListener('click', function () {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
    });

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var next = (currentTrackIdx + 1) % TRACKS.length;
        switchTrack(next);
      });
    }

    audio.addEventListener('play', function () {
      isPlaying = true;
      if (playHint) playHint.style.display = 'none';
      updatePlayerUI();
    });

    audio.addEventListener('pause', function () {
      isPlaying = false;
      idleReady = false;
      if (playHint) playHint.style.display = '';
      updatePlayerUI();
    });

    audio.addEventListener('ended', function () {
      isPlaying = false;
      idleReady = false;
      if (playHint) playHint.style.display = '';
      if (btnRing) btnRing.style.setProperty('--progress', 0);
      updatePlayerUI();
    });

    audio.addEventListener('timeupdate', function () {
      if (timeDisplay) {
        timeDisplay.textContent = formatTime(audio.currentTime);
      }
      if (btnRing && audio.duration) {
        var progress = audio.currentTime / audio.duration;
        btnRing.style.setProperty('--progress', progress);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
