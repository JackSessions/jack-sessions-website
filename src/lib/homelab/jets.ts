// Two pairs of low-poly fighters dogfighting over the map: F-35s (blue) versus Su-27s (red).
// Original primitive models, procedural flight paths, missiles, flares, explosions and contrails.
import type * as T from 'three';
type THREE = typeof import('three');

function jet(THREE: THREE, kind: 'f35' | 'su27', accent: number) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: kind === 'f35' ? 0x6c7a88 : 0x5d6b4a, metalness: 0.6, roughness: 0.45, emissive: accent, emissiveIntensity: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2128, metalness: 0.7, roughness: 0.4 });
  const L = kind === 'f35' ? 2.3 : 2.9;
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.2, kind === 'f35' ? 0.32 : 0.27, L, 10), body); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, kind === 'f35' ? 0.8 : 1.1, 10), body); nose.rotation.x = Math.PI / 2; nose.position.z = L / 2 + (kind === 'f35' ? 0.35 : 0.5); g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0a1018, emissive: 0x2ad0ff, emissiveIntensity: 0.4 })); canopy.scale.set(0.8, 0.7, 1.9); canopy.position.set(0, 0.2, 0.5); g.add(canopy);
  // wings (swept, flat)
  const wingGeo = new THREE.BufferGeometry(); const s = kind === 'f35' ? 1.3 : 1.55; const r = kind === 'f35' ? 1.1 : 1.25;
  const v = [0, 0, r * 0.55, s, 0, -r * 0.35, 0, 0, -r * 0.55]; wingGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); wingGeo.computeVertexNormals();
  for (const side of [1, -1]) { const w = new THREE.Mesh(wingGeo, body); w.material = (body as T.MeshStandardMaterial).clone(); (w.material as T.MeshStandardMaterial).side = THREE.DoubleSide; w.scale.x = side; w.position.z = -0.1; g.add(w); }
  // tails
  const tail = (x: number, canted: number) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, kind === 'f35' ? 0.65 : 0.95, 0.55), body); t.position.set(x, 0.4, -L / 2 + 0.1); t.rotation.z = canted; g.add(t); };
  tail(0.3, kind === 'f35' ? -0.35 : 0); tail(-0.3, kind === 'f35' ? 0.35 : 0);
  for (const x of [0.18, -0.18]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.3, 10), dark); e.rotation.x = Math.PI / 2; e.position.set(kind === 'f35' ? x * 0.5 : x * 1.4, 0, -L / 2); g.add(e);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 8), new THREE.MeshBasicMaterial({ color: 0xffa24a })); f.rotation.x = -Math.PI / 2; f.position.set(kind === 'f35' ? x * 0.5 : x * 1.4, 0, -L / 2 - 0.4); f.userData.flame = true; g.add(f); }
  g.scale.setScalar(2.0);
  return g;
}

export function createAir(THREE: THREE) {
  const root = new THREE.Group();
  type Plane = { g: T.Group; hostile: boolean; phase: number; dir: number; r: number; alt: number; trail: T.Line; pts: T.Vector3[]; pos: T.Vector3; prev: T.Vector3; roll: number };
  const planes: Plane[] = [];
  const mkTrail = (col: number) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(60 * 3), 3)); const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.7 })); l.frustumCulled = false; root.add(l); return l; };
  const specs: [boolean, number, number, number, number][] = [[false, 0, 1, 13, 8], [true, 0.55, 1, 13, 8.4], [false, 3.1, -1, 18, 11], [true, 3.65, -1, 18, 11.4]];
  for (const [hostile, phase, dir, r, alt] of specs) {
    const g = jet(THREE, hostile ? 'su27' : 'f35', hostile ? 0xff4d5e : 0x38d6ff); root.add(g);
    planes.push({ g, hostile, phase, dir, r, alt, trail: mkTrail(hostile ? 0xff7a7a : 0x7ad7ff), pts: [], pos: new THREE.Vector3(), prev: new THREE.Vector3(), roll: 0 });
  }
  // effects pools
  type Fx = { m: T.Mesh | T.Line; life: number; max: number; vel?: T.Vector3; kind: 'missile' | 'flare' | 'boom'; from?: T.Vector3; to?: T.Vector3 };
  const fx: Fx[] = [];
  const spawnMissile = (from: T.Vector3, to: T.Vector3) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xffe14a })); root.add(m); fx.push({ m, life: 0, max: 1.2, kind: 'missile', from: from.clone(), to: to.clone() }); };
  const spawnBoom = (p: T.Vector3) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa24a, transparent: true, opacity: 0.9 })); m.position.copy(p); root.add(m); fx.push({ m, life: 0, max: 0.7, kind: 'boom' }); };
  const spawnFlare = (p: T.Vector3) => { for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a })); m.position.copy(p); root.add(m); fx.push({ m, life: 0, max: 1.6, kind: 'flare', vel: new THREE.Vector3((Math.random() - 0.5) * 2, -1.2 - Math.random(), (Math.random() - 0.5) * 2) }); } };
  let nextShot = 2, nextFlare = 5, intensity = 1;
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  function place(p: Plane, t: number, cx: number, cz: number) {
    const a = p.phase + t * 0.32 * p.dir * intensity; // fighters chase: hostile slightly ahead of its pursuer
    const wob = Math.sin(t * 0.9 + p.phase * 3) * 3;
    p.pos.set(cx + Math.cos(a) * (p.r * 1.45 + wob), p.alt + Math.sin(t * 0.7 + p.phase * 2) * 1.8, cz + Math.sin(a * 1.0) * (p.r * 0.75 + wob * 0.6));
  }
  function update(t: number, dt: number, cx: number, cz: number, cinematic = false) {
    intensity = cinematic ? 1.9 : 1;
    for (const p of planes) {
      p.prev.copy(p.pos); place(p, t, cx, cz);
      p.g.position.copy(p.pos);
      tmp.copy(p.pos).sub(p.prev); if (tmp.lengthSq() > 1e-8) {
        tmp.normalize(); const target = p.pos.clone().add(tmp); p.g.lookAt(target);
        const side = new THREE.Vector3().crossVectors(tmp, up); const turn = side.dot(new THREE.Vector3(Math.cos(t), 0, Math.sin(t)));
        p.roll += ((p.dir * -0.9 + Math.sin(t * 1.3 + p.phase) * 0.4 + turn * 0.0) - p.roll) * 0.05; p.g.rotateZ(p.roll);
      }
      p.g.children.forEach((c) => { if (c.userData.flame) c.scale.y = 0.8 + Math.random() * 0.5; });
      p.pts.unshift(p.pos.clone()); if (p.pts.length > 60) p.pts.pop();
      const arr = p.trail.geometry.attributes.position as T.BufferAttribute;
      for (let i = 0; i < 60; i++) { const q = p.pts[Math.min(i, p.pts.length - 1)] ?? p.pos; arr.setXYZ(i, q.x, q.y, q.z); } arr.needsUpdate = true;
    }
    nextShot -= dt; nextFlare -= dt;
    if (nextShot <= 0) { const k = Math.random() < 0.5 ? 0 : 2; const from = planes[k].g.position, to = planes[k + 1].g.position; spawnMissile(from, to); nextShot = 2.5 + Math.random() * 3; if (Math.random() < 0.5) { const swap = Math.random() < 0.5; spawnMissile(planes[k + 1].g.position, planes[swap ? k : k + 1].g.position); } }
    if (nextFlare <= 0) { const k = [1, 3][Math.floor(Math.random() * 2)]; spawnFlare(planes[k].g.position); nextFlare = 3 + Math.random() * 4; }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life += dt; const u = f.life / f.max;
      if (f.kind === 'missile') { const m = f.m as T.Mesh; m.position.lerpVectors(f.from!, f.to!, Math.min(1, u)); m.lookAt(f.to!); m.rotateX(Math.PI / 2); if (u >= 1) { spawnBoom(f.to!); root.remove(m); fx.splice(i, 1); } }
      else if (f.kind === 'flare') { f.m.position.addScaledVector(f.vel!, dt); { const fm = (f.m as T.Mesh).material as T.MeshBasicMaterial; fm.opacity = 1 - u; fm.transparent = true; } if (u >= 1) { root.remove(f.m); fx.splice(i, 1); } }
      else { const s = 1 + u * 5; f.m.scale.setScalar(s); ((f.m as T.Mesh).material as T.MeshBasicMaterial).opacity = 0.9 * (1 - u); if (u >= 1) { root.remove(f.m); fx.splice(i, 1); } }
    }
  }
  return { group: root, update, setVisible: (v: boolean) => (root.visible = v) };
}
