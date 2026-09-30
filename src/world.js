// src/world.js ── 小游戏版渲染世界（赛道 + 车 + 追逐相机 + 漂移物理 + HUD 叠层）
// 这是 Drift Rush 小游戏的「可玩内核」POC：证明 three-platformize r133 管线在小游戏
// 运行时里能渲染、能触控驾驶、能叠 HUD。后续可把网页版 world.js(r158) 的更多特性
// （后处理/天空/道具/AI 对手）增量移植进来，本文件作为可替换渲染层。

export function createWorld(THREE, canvas, gl, info) {
  const W = info.windowWidth;
  const H = info.windowHeight;
  const dpr = info.pixelRatio || 1;

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x0b1020, 1);
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1020, 120, 700);

  const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 3000);
  camera.position.set(0, 12, 26);
  camera.lookAt(0, 3, 0);

  // 灯光
  scene.add(new THREE.AmbientLight(0xbfd4ff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(60, 120, 40);
  scene.add(sun);

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x1b3a26, roughness: 0.98, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // 赛道（沿 -Z 延伸的深色带）
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 2000, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9, metalness: 0.05 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  scene.add(road);

  // 赛道中线标记（固定世界坐标，随车驶过产生速度感，越过后回收到远方）
  const markers = new THREE.Group();
  const markerGeo = new THREE.BoxGeometry(0.6, 0.02, 6);
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0x553300, roughness: 0.6 });
  const MARKER_COUNT = 60;
  const MARKER_GAP = 30;
  for (let i = 0; i < MARKER_COUNT; i++) {
    const m = new THREE.Mesh(markerGeo, markerMat);
    m.position.set(0, 0.05, -i * MARKER_GAP);
    markers.add(m);
  }
  scene.add(markers);

  // 路侧柱子（强化速度感）
  const posts = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(1.2, 8, 1.2);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x394b6b, roughness: 0.8 });
  const POST_COUNT = 40;
  const POST_GAP = 45;
  for (let i = 0; i < POST_COUNT; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(side * 26, 4, -i * POST_GAP);
    posts.add(p);
  }
  scene.add(posts);

  // 车辆（低多边形风格：车身 + 车顶 + 四轮）
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.35, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x223044, roughness: 0.2, metalness: 0.5 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 8), bodyMat);
  body.position.y = 1.4;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3.6), glassMat);
  cabin.position.set(0, 2.6, -0.4);
  car.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(1, 1, 0.8, 16);
  const wheelPos = [[-2, 1, 2.6], [2, 1, 2.6], [-2, 1, -2.6], [2, 1, -2.6]];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    car.add(w);
  }
  scene.add(car);

  // HUD 叠层：离屏 2D canvas → CanvasTexture → 全屏 quad（纯 WebGL，无 DOM）
  let hudTex = null;
  let hudScene = null;
  let hudCam = null;
  let hudEnabled = false;
  let world_hud = null;
  try {
    const hudCanvas = wx.createOffscreenCanvas({ type: "2d", width: 1280, height: 720 });
    const hudCtx = hudCanvas.getContext("2d");
    hudTex = new THREE.CanvasTexture(hudCanvas);
    hudTex.minFilter = THREE.LinearFilter;
    hudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    hudCam.position.z = 1;
    const hudQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false })
    );
    hudQuad.position.z = 0;
    hudScene = new THREE.Scene();
    hudScene.add(hudQuad);
    world_hud = { canvas: hudCanvas, ctx: hudCtx };
    hudEnabled = true;
  } catch (e) {
    console.warn("[world] HUD 初始化失败，跳过叠层:", e);
  }

  // 物理状态
  const state = { x: 0, z: 0, heading: 0, speed: 0, drift: 0, lapTime: 0, best: null, score: 0 };

  function update(dt, input) {
    const maxSpeed = 220;
    const accel = 140;
    if (input.throttle > 0) state.speed += accel * input.throttle * dt;
    else state.speed -= 60 * dt; // 滑行阻力
    if (input.brake > 0) state.speed -= 260 * input.brake * dt;
    state.speed = Math.max(0, Math.min(maxSpeed, state.speed));

    const steerRate = 0.9 + (state.speed / maxSpeed) * 1.4;
    state.heading += input.steer * steerRate * dt;
    const targetDrift = input.steer * (state.speed / maxSpeed) * 0.6;
    state.drift += (targetDrift - state.drift) * Math.min(1, dt * 6);

    const vx = Math.sin(state.heading) * state.speed;
    const vz = -Math.cos(state.heading) * state.speed;
    state.x += vx * dt;
    state.z += vz * dt;
    state.x = Math.max(-18, Math.min(18, state.x)); // 限制不出赛道

    car.position.set(state.x, 0, state.z);
    car.rotation.y = state.heading + state.drift * 0.5;

    // 相机追逐
    const camBehind = 26;
    const camHeight = 12;
    const cx = state.x - Math.sin(state.heading) * camBehind;
    const cz = state.z + Math.cos(state.heading) * camBehind;
    camera.position.set(cx, camHeight, cz);
    camera.lookAt(state.x + Math.sin(state.heading) * 8, 3, state.z - Math.cos(state.heading) * 8);

    // 标记/柱子回收（制造无限赛道）
    markers.children.forEach((m) => {
      if (m.position.z > state.z + camBehind + 40) m.position.z -= MARKER_COUNT * MARKER_GAP;
    });
    posts.children.forEach((p) => {
      if (p.position.z > state.z + camBehind + 60) p.position.z -= POST_COUNT * POST_GAP;
    });

    state.lapTime += dt;
    state.score += state.speed * dt * 0.1;
    // 用固定里程当「一圈」，过线刷新最佳
    if (state.z < -1000 && Math.abs(state.x) < 6) {
      if (state.best == null || state.lapTime < state.best) state.best = state.lapTime;
      state.lapTime = 0;
    }

    return state;
  }

  function drawHUD(s) {
    if (!hudEnabled || !world_hud) return;
    const c = world_hud.ctx;
    const W2 = 1280, H2 = 720; // 横屏比例，避免纹理被拉伸变形
    c.clearRect(0, 0, W2, H2);
    // 左上：核心数据
    c.textAlign = "left";
    c.fillStyle = "#ffffff";
    c.font = "bold 56px sans-serif";
    c.fillText("速度 " + Math.round(s.speed) + " km/h", 36, 76);
    c.font = "bold 40px sans-serif";
    c.fillStyle = s.drift > 0.15 ? "#ffd24a" : "#9fb3d1";
    c.fillText(s.drift > 0.15 ? "DRIFT!" : "稳定", 36, 132);
    c.fillStyle = "#cfe0ff";
    c.font = "34px sans-serif";
    c.fillText("本圈 " + s.lapTime.toFixed(1) + "s", 36, 184);
    c.fillText("得分 " + Math.round(s.score), 36, 228);
    if (s.best != null) c.fillText("最佳 " + s.best.toFixed(1) + "s", 36, 272);
    // 右上：分享提示（与 game.js 右上角热区对应）
    c.textAlign = "right";
    c.fillStyle = "#7fd1a0";
    c.font = "30px sans-serif";
    c.fillText("右上角轻触分享成绩", W2 - 36, 76);
    hudTex.needsUpdate = true;
  }

  function render() {
    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (hudEnabled && hudScene) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(hudScene, hudCam);
    }
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  return { update, drawHUD, render, resize, state, camera, scene, renderer };
}
