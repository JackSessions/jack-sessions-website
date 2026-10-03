// Range-builder rules engine: pure functions, no DOM. Used by the Build and Play modes of the homelab map.
export type Zone = 'wan' | 'dmz' | 'lan' | 'mgmt' | 'range';
export type BNode = { id: string; kind: string; zone: Zone; name: string };
export type BLink = { a: string; b: string };
export type Board = { nodes: BNode[]; links: BLink[] };
export type Issue = { sev: 'bad' | 'warn' | 'tip'; msg: string; ids: string[]; add?: string };

const KIND_EXPOSED_BY_DESIGN = new Set(['tor', 'firewall', 'vpn', 'cloud']);
export const isMalware = (n: BNode) => n.kind === 'lxc';

// What the firewall lets through, by where the traffic started and where it is heading.
function fwAllow(origin: Zone, to: BNode): boolean {
  if (to.kind === 'vpn' && origin === 'wan') return true;      // the WireGuard / Tailscale port
  switch (origin) {
    case 'range': return to.zone === 'range';                   // the zoo never talks out
    case 'wan': return to.zone === 'dmz' && to.kind === 'tor';  // only the relay is published
    case 'dmz': return to.zone === 'wan' || to.zone === 'dmz';
    case 'lan': return to.zone !== 'mgmt' && to.zone !== 'range';
    case 'mgmt': return true;                                   // admins can reach everything
  }
}

export type Reach = { path: string[] };
export type Blocked = { at: string; to: string; reason: string; path: string[] };

// Breadth-first search for where traffic from `sources` can travel.
export function reach(board: Board, sources: BNode[], origin: Zone, auth: boolean) {
  const byId = new Map(board.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  for (const l of board.links) { (adj.get(l.a) ?? adj.set(l.a, []).get(l.a)!).push(l.b); (adj.get(l.b) ?? adj.set(l.b, []).get(l.b)!).push(l.a); }
  const seen = new Map<string, Reach>(); const blocked: Blocked[] = []; const q: string[] = [];
  for (const s of sources) { seen.set(s.id, { path: [s.id] }); q.push(s.id); }
  while (q.length) {
    const uId = q.shift()!; const u = byId.get(uId)!; const upath = seen.get(uId)!.path;
    for (const vId of adj.get(uId) ?? []) {
      if (seen.has(vId)) continue; const v = byId.get(vId)!; let ok = true; let reason = '';
      if (u.zone === 'range' && v.kind === 'server') { ok = false; reason = 'guests cannot reach the hypervisor'; }
      else if ((u.kind === 'switch' || v.kind === 'switch') && u.zone !== v.zone && u.kind !== 'firewall' && v.kind !== 'firewall') { ok = false; reason = 'VLAN boundary'; }
      else if (u.kind === 'vpn' && !auth && v.zone !== 'wan' && v.kind !== 'firewall') { ok = false; reason = 'VPN needs a key'; }
      else if (u.kind === 'firewall' && !fwAllow(origin, v)) { ok = false; reason = `firewall denies ${origin.toUpperCase()} → ${v.zone.toUpperCase()}`; }
      if (!ok) { blocked.push({ at: uId, to: vId, reason, path: upath }); continue; }
      seen.set(vId, { path: [...upath, vId] }); q.push(vId);
    }
  }
  return { reached: seen, blocked };
}

export function exposure(board: Board) {
  const wans = board.nodes.filter((n) => n.kind === 'cloud');
  const res = reach(board, wans, 'wan', false);
  const breached = board.nodes.filter((n) => res.reached.has(n.id) && n.zone !== 'wan' && !KIND_EXPOSED_BY_DESIGN.has(n.kind));
  return { ...res, breached };
}
export function escape(board: Board) {
  const mal = board.nodes.filter(isMalware);
  const res = reach(board, mal, 'range', false);
  const escaped = board.nodes.filter((n) => res.reached.has(n.id) && n.zone !== 'range' && n.kind !== 'firewall');
  return { ...res, escaped, hasMalware: mal.length > 0 };
}

const list = (xs: string[]) => (xs.length <= 3 ? xs.join(', ') : `${xs.slice(0, 3).join(', ')} and ${xs.length - 3} more`);

export function lint(board: Board) {
  const byId = new Map(board.nodes.map((n) => [n.id, n])); const issues: Issue[] = [];
  const has = (k: string) => board.nodes.some((n) => n.kind === k);
  const nm = (id: string) => byId.get(id)?.name ?? id;
  const wans = board.nodes.filter((n) => n.kind === 'cloud');

  // 1. WAN must land on the firewall
  for (const l of board.links) {
    const a = byId.get(l.a)!, b = byId.get(l.b)!; if (!a || !b) continue;
    for (const [w, o] of [[a, b], [b, a]] as const) if (w.kind === 'cloud' && o.kind !== 'firewall' && o.kind !== 'vpn')
      issues.push({ sev: 'bad', msg: `WAN is plugged straight into ${o.name}. The WAN only ever terminates on the firewall's WAN port. Never put WAN on the LAN.`, ids: [w.id, o.id], add: has('firewall') ? undefined : 'firewall' });
  }
  if (wans.length && !has('firewall')) issues.push({ sev: 'bad', msg: 'There is no firewall between the internet and your gear.', ids: wans.map((w) => w.id), add: 'firewall' });

  // 2. zones joined without a firewall
  for (const l of board.links) {
    const a = byId.get(l.a)!, b = byId.get(l.b)!; if (!a || !b || a.zone === b.zone) continue;
    if ([a, b].some((n) => ['firewall', 'vpn', 'cloud', 'switch'].includes(n.kind))) continue;
    if ((a.kind === 'server' && b.zone === 'range') || (b.kind === 'server' && a.zone === 'range')) continue;
    issues.push({ sev: 'warn', msg: `${a.name} (${a.zone.toUpperCase()}) is linked straight to ${b.name} (${b.zone.toUpperCase()}). Put a firewall between zones and default-deny.`, ids: [a.id, b.id], add: has('firewall') ? undefined : 'firewall' });
  }

  // 3. malware must not escape
  const esc = escape(board);
  if (esc.escaped.length) issues.push({ sev: 'bad', msg: `Malware can reach ${list(esc.escaped.map((n) => n.name))}. Keep the zoo air-gapped: fake the internet with INetSim instead of routing out.`, ids: esc.escaped.map((n) => n.id) });

  // 4. external exposure
  const ex = exposure(board);
  if (ex.breached.length) issues.push({ sev: 'bad', msg: `${list(ex.breached.map((n) => n.name))} ${ex.breached.length > 1 ? 'are' : 'is'} reachable from the internet. Publish only what you must, and reach admin systems over a VPN.`, ids: ex.breached.map((n) => n.id) });

  // 5. placement
  for (const n of board.nodes) {
    if (n.kind === 'tor' && n.zone !== 'dmz') issues.push({ sev: 'warn', msg: `${n.name}: a Tor relay belongs in the DMZ, not on ${n.zone.toUpperCase()}.`, ids: [n.id] });
    if (n.kind === 'server' && (n.zone === 'wan' || n.zone === 'dmz')) issues.push({ sev: 'bad', msg: `${n.name}: the hypervisor must never sit in ${n.zone.toUpperCase()}. Keep management on its own VLAN.`, ids: [n.id] });
    if (n.kind === 'attacker' && (n.zone === 'lan' || n.zone === 'mgmt')) issues.push({ sev: 'warn', msg: `${n.name}: keep attack tooling inside the range, not on a production network.`, ids: [n.id] });
    if (n.kind === 'git' && (n.zone === 'wan' || n.zone === 'dmz')) issues.push({ sev: 'warn', msg: `${n.name}: a private Git server shouldn't be public. Put it behind the VPN.`, ids: [n.id] });
    if (n.kind === 'lxc' && n.zone !== 'range') issues.push({ sev: 'bad', msg: `${n.name}: malware belongs in the isolated range zone.`, ids: [n.id] });
  }

  // 6. connectivity
  const linked = new Set(board.links.flatMap((l) => [l.a, l.b]));
  for (const n of board.nodes) if (!linked.has(n.id) && board.nodes.length > 1) issues.push({ sev: 'tip', msg: `${n.name} isn't connected to anything yet.`, ids: [n.id] });

  // 7. suggestions (what a solid lab usually has)
  if (board.nodes.length) {
    if (!has('vpn')) issues.push({ sev: 'tip', msg: 'Add WireGuard or Tailscale so you can administer the lab remotely without opening ports.', ids: [], add: 'vpn' });
    if (!has('switch')) issues.push({ sev: 'tip', msg: 'Add a managed switch and give each zone its own VLAN.', ids: [], add: 'switch' });
    if (!has('siem')) issues.push({ sev: 'tip', msg: 'Add logging (a SIEM or Velociraptor server). If you can\'t see it, you can\'t defend it.', ids: [], add: 'siem' });
    if (!has('storage')) issues.push({ sev: 'tip', msg: 'Add storage for backups and snapshots. Test restores, not just backups.', ids: [], add: 'storage' });
    if (!has('server')) issues.push({ sev: 'tip', msg: 'Add a hypervisor (Proxmox) so ranges can be snapshotted and rolled back.', ids: [], add: 'server' });
  }

  const bad = issues.filter((i) => i.sev === 'bad').length, warn = issues.filter((i) => i.sev === 'warn').length, tip = issues.filter((i) => i.sev === 'tip').length;
  const score = board.nodes.length ? Math.max(0, 100 - bad * 18 - warn * 7 - tip * 2) : 0;
  const grade = !board.nodes.length ? '–' : score >= 92 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 45 ? 'C' : score >= 25 ? 'D' : 'F';

  const checklist = [
    { rule: 'WAN terminates on the firewall only', ok: wans.length > 0 && has('firewall') && !issues.some((i) => i.sev === 'bad' && i.msg.startsWith('WAN is plugged')) },
    { rule: 'Nothing but the Tor relay is reachable from the internet', ok: wans.length > 0 && ex.breached.length === 0 },
    { rule: 'Malware cannot leave the range', ok: esc.hasMalware && esc.escaped.length === 0 },
    { rule: 'Remote admin goes through a VPN', ok: has('vpn') },
    { rule: 'Tor relay lives in the DMZ', ok: board.nodes.filter((n) => n.kind === 'tor').length > 0 && board.nodes.filter((n) => n.kind === 'tor').every((n) => n.zone === 'dmz') },
    { rule: 'You are collecting logs', ok: has('siem') },
    { rule: 'Backups and snapshots exist', ok: has('storage') },
  ];
  return { issues, score, grade, checklist, bad, warn, tip, nm };
}

// ------------------------------------------------------------ play mode
export type Strike = { kind: 'breach' | 'blocked' | 'exposed' | 'escape'; path: string[]; target: string; note: string };
export function simulate(board: Board): Strike[] {
  const strikes: Strike[] = []; const byId = new Map(board.nodes.map((n) => [n.id, n]));
  const ex = exposure(board);
  for (const [id, r] of ex.reached) { const n = byId.get(id)!; if (n.zone === 'wan' && n.kind === 'cloud') continue;
    if (n.kind === 'tor' || n.kind === 'firewall' || n.kind === 'vpn') strikes.push({ kind: 'exposed', path: r.path, target: id, note: `${n.name} is exposed by design` });
    else strikes.push({ kind: 'breach', path: r.path, target: id, note: `${n.name} compromised from the internet` }); }
  for (const b of ex.blocked) strikes.push({ kind: 'blocked', path: [...b.path, b.to], target: b.at, note: b.reason });
  const esc = escape(board);
  for (const [id, r] of esc.reached) { const n = byId.get(id)!; if (n.zone !== 'range') strikes.push({ kind: 'escape', path: r.path, target: id, note: `malware escaped to ${n.name}` }); }
  for (const b of esc.blocked) strikes.push({ kind: 'blocked', path: [...b.path, b.to], target: b.at, note: `malware contained: ${b.reason}` });
  return strikes;
}

// ------------------------------------------------------------ templates
const T = (id: string, kind: string, zone: Zone, name: string): BNode => ({ id, kind, zone, name });
export const TEMPLATES: Record<string, { label: string; board: Board; pos: Record<string, [number, number]> }> = {
  flat: {
    label: 'Flat home network (the mistake)',
    board: {
      nodes: [T('w', 'cloud', 'wan', 'Internet'), T('p', 'server', 'lan', 'Proxmox'), T('g', 'git', 'lan', 'Gitea'), T('m', 'lxc', 'lan', 'Malware LXC'), T('t', 'tor', 'lan', 'Tor relay')],
      links: [{ a: 'w', b: 'p' }, { a: 'p', b: 'g' }, { a: 'p', b: 'm' }, { a: 'w', b: 't' }],
    },
    pos: { w: [-17, 0], p: [-1, 0], g: [-1, -6], m: [-1, 6], t: [-9, -6] },
  },
  solid: {
    label: 'Solid starter lab',
    board: {
      nodes: [T('w', 'cloud', 'wan', 'Internet'), T('f', 'firewall', 'lan', 'OPNsense'), T('t', 'tor', 'dmz', 'Tor relay'), T('s', 'switch', 'lan', 'VLAN switch'), T('v', 'vpn', 'mgmt', 'WireGuard'),
        T('p', 'server', 'mgmt', 'Proxmox'), T('g', 'git', 'lan', 'Gitea'), T('l', 'siem', 'lan', 'Logs'), T('n', 'storage', 'lan', 'NAS'), T('z1', 'lxc', 'range', 'Zoo LXC 1'), T('z2', 'lxc', 'range', 'Zoo LXC 2'), T('zs', 'switch', 'range', 'Zoo switch')],
      links: [{ a: 'w', b: 'f' }, { a: 'f', b: 't' }, { a: 'f', b: 's' }, { a: 'f', b: 'v' }, { a: 'v', b: 'p' }, { a: 's', b: 'p' }, { a: 's', b: 'g' }, { a: 's', b: 'l' }, { a: 's', b: 'n' }, { a: 'p', b: 'zs' }, { a: 'zs', b: 'z1' }, { a: 'zs', b: 'z2' }],
    },
    pos: { w: [-17, 0], f: [-9, 0], t: [-9, -6], s: [-1, 0], v: [6, 6], p: [6, 0], g: [-1, -6], l: [-1, 6], n: [-1, 11], z1: [14, -3], z2: [14, 3], zs: [11, 0] },
  },
};
