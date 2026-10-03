// 3D models for map nodes. Everything is built from primitives, no assets. THREE is passed in because it is loaded on demand.
import type * as T from 'three';
type THREE = typeof import('three');

export function makeVisual(THREE: THREE, kind: string, color: string, members: string[] = []): T.Group {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const mat = (col: T.ColorRepresentation = color, e = 0.35) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.5), emissive: new THREE.Color(col), emissiveIntensity: e, metalness: 0.4, roughness: 0.5 });
  const basic = (col: T.ColorRepresentation) => new THREE.MeshBasicMaterial({ color: col });
  const edges = (geo: T.BufferGeometry, col: T.ColorRepresentation = color) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col }));
  const box = (w: number, h: number, d: number, x = 0, z = 0, col: T.ColorRepresentation = color, y0 = 0.18) => {
    const geo = new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(geo, mat(col)); m.position.set(x, h / 2 + y0, z); m.add(edges(geo, col)); g.add(m); return m;
  };
  const add = <O extends T.Object3D>(o: O, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); g.add(o); return o; };
  const spin = (o: T.Object3D, s: number) => { o.userData.spin = s; return o; };

  switch (kind) {
    case 'server': {
      box(2.2, 3.4, 1.8, -0.6, 0);
      for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.05), basic(i % 2 ? 0x4af0a2 : 0x38d6ff)), -0.6, 0.7 + i * 0.6, 0.93);
      members.forEach((_, i) => box(0.9, 0.9, 0.9, 1.4, -1.4 + i * 0.95, i < 2 ? '#7ad7ff' : '#4af0a2'));
      break;
    }
    case 'cloud': {
      [[0, 0], [0.9, 0.2], [-0.9, 0.1], [0.3, 0.6]].forEach(([x, y], i) =>
        add(new THREE.Mesh(new THREE.SphereGeometry(0.8 - i * 0.05, 20, 16), new THREE.MeshStandardMaterial({ color: 0x24456e, emissive: c, emissiveIntensity: 0.4 })), x, 2.2 + y, 0));
      break;
    }
    case 'tor': {
      spin(add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), mat(color, 0.5)), 0, 1.6), 0.6);
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 8, 40), basic(color)), 0, 1.6); ring.rotation.x = Math.PI / 2.4; spin(ring, -0.9);
      break;
    }
    case 'vpn': {
      spin(add(new THREE.Mesh(new THREE.OctahedronGeometry(0.9), mat(color, 0.55)), 0, 1.6), 0.5);
      const orbit = new THREE.Group(); orbit.position.y = 1.6; spin(orbit, 0.8);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), basic(color)); s.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5); orbit.add(s); }
      g.add(orbit); break;
    }
    case 'mini': { box(1.6, 0.55, 1.6); add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.05), basic(0x4af0a2)), -0.5, 0.45, 0.82); break; }
    case 'laptop': {
      box(2.2, 0.16, 1.5, 0, 0);
      const scr = box(2.1, 1.2, 0.08, 0, -0.7, color, 0.34); scr.rotation.x = -0.35;
      add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.02), basic(c.clone().multiplyScalar(1.2))), 0, 1.0, -0.62).rotation.x = -0.35;
      break;
    }
    case 'firewall': {
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) box(0.9, 0.5, 0.5, -1 + k * 1 + (r % 2 ? 0.5 : 0), 0, r % 2 ? '#ff7a2e' : color, 0.18 + r * 0.52);
      spin(add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4), basic(0xffb02e)), 0, 2.4), 1.2);
      break;
    }
    case 'switch': {
      box(3, 0.45, 1.2);
      for (let i = 0; i < 8; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), basic(i % 3 ? 0x4af0a2 : 0xffb02e)), -1.2 + i * 0.34, 0.55, 0.62);
      break;
    }
    case 'dc': { box(1.2, 2.0, 1.2); spin(add(new THREE.Mesh(new THREE.OctahedronGeometry(0.35), basic(0xffe14a)), 0, 2.7), 1); break; }
    case 'ws': { box(1.0, 0.1, 0.8, 0, 0); box(0.14, 0.5, 0.14, 0, 0, color, 0.28); const m = box(1.3, 0.85, 0.1, 0, 0, color, 0.8); void m; break; }
    case 'dev': { box(1.6, 0.12, 1.0, 0, 0.1); box(1.5, 0.95, 0.1, 0, -0.2, color, 0.55); add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.02), basic(0x1b2a38)), 0, 1.05, -0.14); break; }
    case 'lxc': {
      const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9); const m = new THREE.Mesh(geo, mat(color, 0.5)); m.position.y = 0.65; m.add(edges(geo)); spin(m, 0.3); g.add(m); break;
    }
    case 'siem': {
      for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(1.0 - i * 0.12, 1.0 - i * 0.12, 0.35, 24), mat(color, 0.3 + i * 0.1)), 0, 0.4 + i * 0.4);
      spin(add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), basic(0xffe14a)), 0, 2.0), 0); break;
    }
    case 'git': {
      const pts: [number, number, number][] = [[0, 0.5, 0], [0, 1.5, 0], [0.8, 2.1, 0]];
      pts.forEach((p) => add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), mat(color, 0.6)), ...p));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color })); g.add(line);
      const br = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(-0.8, 1.1, 0), new THREE.Vector3(-0.8, 1.9, 0)]), new THREE.LineBasicMaterial({ color })); g.add(br);
      break;
    }
    case 'mac': { box(1.9, 0.14, 1.3, 0, 0); const lid = box(1.9, 1.2, 0.07, 0, -0.62, '#c9d3dc', 0.3); lid.rotation.x = -0.3; spin(add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), basic(0xffffff)), 0, 1.0, -0.5), 0); break; }
    case 'android': {
      add(new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 6, 12), mat(color, 0.5)), 0, 1.0);
      [-0.15, 0.15].forEach((x) => add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), basic(0xffffff)), x, 1.45, 0.4));
      break;
    }
    case 'phone': { box(0.9, 1.6, 0.14, 0, 0, color, 0.3); add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.35, 0.02), basic(c.clone().multiplyScalar(0.8))), 0, 1.0, 0.09); break; }
    case 'ai': {
      spin(add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), mat(color, 0.7)), 0, 1.7), 0.6);
      const swarm = new THREE.Group(); swarm.position.y = 1.7; spin(swarm, 1.4);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const cube = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), basic(color)); cube.position.set(Math.cos(a) * 1.7, Math.sin(a * 2) * 0.5, Math.sin(a) * 1.7); swarm.add(cube); }
      g.add(swarm); break;
    }
    case 'storage': { for (let i = 0; i < 3; i++) box(1.8, 0.4, 1.2, 0, 0, i === 1 ? '#7ad7ff' : color, 0.18 + i * 0.46); break; }
    case 'attacker': { const p = add(new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.7, 4), mat(color, 0.6)), 0, 1.1); spin(p, 0.7); break; }
    case 'portal': {
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 12, 40), basic(color)), 0, 1.7); spin(ring, 0.5);
      const ring2 = add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 32), basic(0xffffff)), 0, 1.7); spin(ring2, -0.9);
      add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide })), 0, 1.7);
      break;
    }
    default: box(1.4, 1.4, 1.4);
  }
  return g;
}

export function plate(THREE: THREE, w: number, d: number, color: string) {
  const geo = new THREE.BoxGeometry(w, 0.18, d);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.18), emissive: new THREE.Color(color), emissiveIntensity: 0.12, transparent: true, opacity: 0.8 }));
  m.position.y = 0.09;
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color })); e.position.y = 0.09;
  return [m, e] as const;
}
