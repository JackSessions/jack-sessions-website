// The homelab battle maps. Edit this file to change what the 3D maps show and what each node says.
// Positions are [x, z] on the map floor. Text fields are plain text.
// NOTE: node descriptions are first drafts based on the lab's purpose. Correct anything that doesn't match your real setup.

export type LabNode = {
  id: string; name: string; kind: string; zone: string; color: string; pos: [number, number]; size: [number, number];
  summary: string; why: string; services: string[]; members?: string[]; goto?: string; lesson?: string;
};
export type LabLink = { from: string; to: string; label: string; style: 'public' | 'admin' | 'normal' | 'isolated' | 'light' };
export type LabMap = {
  id: string; num: string; name: string; tag: string; brief: string; center: [number, number];
  budget: { cores: number; ramGB: number; diskTB: number };
  rules: string[]; learn: { title: string; url: string }[];
  nodes: LabNode[]; links: LabLink[];
};

export const HARDWARE = [
  { name: 'Dell PowerEdge R620', role: 'Proxmox host', spec: '32 cores · 250 GB DDR3 · 10 TB storage', note: 'The heavy iron: every range and the malware zoo run here.' },
  { name: 'Mini PC', role: 'Always-on utility', spec: '4 cores / 8 threads · 8 GB RAM', note: 'Tiny, quiet, never off. Keeps the essentials alive.' },
  { name: 'Lenovo laptop (battle-damaged)', role: 'Tor relay + counter-forensics', spec: 'Beaten up, still fighting', note: 'Dedicated hardware for Tor and anti-forensics work, kept off the main network.' },
];
export const R620 = { cores: 32, ramGB: 250, diskTB: 10 };

const C = { net: '#38d6ff', pub: '#b36bff', vpn: '#4af0a2', warm: '#ffb02e', red: '#ff4d5e', ad: '#5b8cff', gold: '#ffe14a', sky: '#8fb8ff', mac: '#c9d3dc', ai: '#e04aff', and: '#3ddc84' };
const N = (id: string, name: string, kind: string, zone: string, color: string, pos: [number, number], size: [number, number],
  summary: string, why: string, services: string[], extra: Partial<LabNode> = {}): LabNode => ({ id, name, kind, zone, color, pos, size, summary, why, services, ...extra });
const L = (from: string, to: string, label: string, style: LabLink['style'] = 'normal'): LabLink => ({ from, to, label, style });

// ============================================================ MAP 1: NETWORK
const net: LabMap = {
  id: 'net', num: '01', name: 'Network', tag: 'The whole lab', center: [-1, 0],
  brief: 'WAN, firewall, VLANs, WireGuard and the three machines everything runs on. Start here, then drop through a portal into a range.',
  budget: { cores: 4, ramGB: 24, diskTB: 1 },
  rules: ['The WAN plugs into the firewall and nothing else. Never put WAN on the LAN.', 'One VLAN per purpose, default-deny between them.', 'Nothing is port-forwarded. Admin access is WireGuard or Tailscale only.', 'Management (Proxmox, iDRAC) lives on its own VLAN and is never routed to the internet.'],
  learn: [{ title: 'Proxmox VE documentation', url: 'https://pve.proxmox.com/wiki/Main_Page' }, { title: 'OPNsense docs', url: 'https://docs.opnsense.org' }, { title: 'WireGuard quick start', url: 'https://www.wireguard.com/quickstart/' }, { title: 'Tailscale docs', url: 'https://tailscale.com/kb' }, { title: 'Gitea docs', url: 'https://docs.gitea.com' }],
  nodes: [
    N('internet', 'Internet', 'cloud', 'Outside', C.sky, [-19, 0], [3.2, 3.2], 'The untrusted outside world.', 'Everything hostile starts here, so the map draws a hard line between what is exposed and what is not.', ['Public traffic', 'Tor circuits', 'Tailscale coordination'], { lesson: 'Never put the WAN on the LAN side. The WAN port belongs to the firewall.' }),
    N('fw', 'Edge firewall', 'firewall', 'Perimeter', C.warm, [-12, 0], [4.2, 3.4], 'The one door in and out. Default-deny.', 'It is the only device the WAN touches. Every VLAN gets its own rules so a compromise in one zone cannot walk into the next.', ['WAN + VLAN gateways', 'Default-deny rules', 'WireGuard endpoint', 'DNS / DHCP'], { lesson: 'Never plug a WAN cable into a switch port that carries a LAN VLAN.' }),
    N('tor', 'Tor relay laptop', 'laptop', 'DMZ', C.pub, [-12, -8], [4.4, 3.4], 'The beaten-up Lenovo, running a Tor relay on its own network.', 'Hardware you do not mind exposing. A relay teaches how Tor behaves from the operator side, and the laptop doubles as a counter-forensics bench. It has no route into the lab.', ['Tor relay', 'Bandwidth limits', 'Counter-forensics tooling'], { lesson: 'Exit and relay traffic stays in the DMZ. Never run a relay on your trusted LAN.' }),
    N('wg', 'WireGuard', 'vpn', 'VPN', C.vpn, [-12, 8], [4, 3.2], 'A fast, minimal VPN into the management VLAN.', 'It is the front door for me and nobody else. One UDP port, key-based auth, and nothing else is published.', ['WireGuard peers', 'Key-based auth', 'Split tunnel to Mgmt VLAN'], { lesson: 'Publish exactly one port, and make it the VPN.' }),
    N('ts', 'Tailscale', 'vpn', 'Mesh VPN', C.vpn, [-6, 11], [4, 3.2], 'A private mesh that links every device I own.', 'NAT traversal means I can reach the lab from anywhere, without opening a single port. ACLs decide who sees what.', ['WireGuard mesh', 'ACLs', 'Subnet routing']),
    N('sw', 'Core switch', 'switch', 'VLAN trunk', C.net, [-5, 0], [4.4, 3], 'A managed switch carrying every VLAN.', 'VLANs keep zones apart at layer 2: management, production, dev and each range. All crossing traffic has to go through the firewall.', ['802.1Q VLANs', 'Trunk to Proxmox', 'Port isolation']),
    N('proxmox', 'Dell R620 (Proxmox)', 'server', 'Hypervisor', C.net, [4, 0], [7, 6], 'The heavy server: 32 cores, 250 GB of DDR3 RAM and 10 TB of disk.', 'Proxmox makes whole environments cheap: spin one up, snapshot it, break it, roll it back. That is what makes malware and domain attacks safe and repeatable.', ['KVM virtual machines', 'LXC containers', 'Snapshots & backups', 'Virtual networks (one per range)'], { members: ['VM', 'VM', 'LXC', 'LXC'], lesson: 'The hypervisor management interface is never reachable from the WAN or from guests.' }),
    N('minipc', 'Mini PC', 'mini', 'Always-on', C.warm, [-1, 9], [4, 3.2], '4 cores, 8 threads, 8 GB RAM, always on.', 'It keeps the essentials alive when the big server is rebooted, patched or switched off, and acts as a steady foothold on the tailnet.', ['Tailscale node', 'Always-on utilities', 'Backups & monitoring']),
    N('gitea', 'Gitea', 'git', 'Dev VLAN', C.gold, [9, 8], [3.6, 3.2], 'My own Git server.', 'Research, detections and tooling live in my own repositories first. Behind the VPN, it never touches the public internet.', ['Gitea', 'Private repos', 'CI runners'], { lesson: 'Self-hosted Git is private. Put it behind the VPN, never in the DMZ.' }),
    N('dev', 'Dev environment', 'dev', 'Dev VLAN', C.gold, [14, 8], [3.6, 3.2], 'Where code gets written and tested.', 'Disposable development VMs and containers, kept off the research networks so a bad dependency cannot reach anything that matters.', ['Dev VMs', 'Build tooling', 'Language toolchains']),
    N('p-range', 'Cyber range', 'portal', 'Portal: map 02', C.ad, [11, -8], [3.4, 3.4], 'A throwaway Active Directory network with attackers inside.', 'Jump in to see the range.', ['Open map 02'], { goto: 'range' }),
    N('p-zoo', 'Malware zoo', 'portal', 'Portal: map 03', C.red, [17, -4], [3.4, 3.4], '20 LXC containers in an air-gapped network.', 'Jump in to see the zoo.', ['Open map 03'], { goto: 'zoo' }),
    N('p-soc', 'SOC / DFIR + AI', 'portal', 'Portal: map 04', C.ai, [17, 2], [3.4, 3.4], 'Detection engineering, forensics and AI agents.', 'Jump in to see the blue-team lab.', ['Open map 04'], { goto: 'soc' }),
    N('p-mob', 'Mobile & macOS', 'portal', 'Portal: map 05', C.and, [13, 3.5], [3.4, 3.4], 'Android, iOS and a docker-OSX box.', 'Jump in to see the mobile lab.', ['Open map 05'], { goto: 'mobile' }),
  ],
  links: [
    L('internet', 'fw', 'WAN: only ever on the firewall', 'public'), L('fw', 'tor', 'DMZ VLAN', 'public'), L('fw', 'sw', 'LAN trunk'), L('fw', 'wg', 'WireGuard endpoint', 'admin'),
    L('internet', 'ts', 'Tailscale coordination', 'admin'), L('wg', 'sw', 'Into the Mgmt VLAN', 'admin'), L('ts', 'minipc', 'Tailnet', 'admin'), L('ts', 'proxmox', 'Tailnet', 'admin'),
    L('sw', 'proxmox', 'VLAN trunk'), L('sw', 'minipc', 'LAN'), L('proxmox', 'gitea', 'Dev VLAN'), L('proxmox', 'dev', 'Dev VLAN'),
    L('proxmox', 'p-range', 'Range network'), L('proxmox', 'p-zoo', 'Isolated: no route out', 'isolated'), L('proxmox', 'p-soc', 'Blue-team VLAN'), L('proxmox', 'p-mob', 'Mobile VLAN'),
  ],
};

// ============================================================ MAP 2: CYBER RANGE
const range: LabMap = {
  id: 'range', num: '02', name: 'Cyber Range', tag: 'AD attack & defend', center: [2, 0],
  brief: 'A disposable Active Directory network with a Kali attacker, a C2 server and an exposed web app, for practising the full attack path and what each step leaves in the logs.',
  budget: { cores: 12, ramGB: 48, diskTB: 0.6 },
  rules: ['The range gets its own VLAN and its own firewall. It reaches nothing real.', 'Snapshot every machine before an exercise so a reset takes a minute.', 'Log everything. An attack with no telemetry teaches nothing about defence.', 'Treat the attacker box as hostile: it lives inside the range only.'],
  learn: [{ title: 'GOAD: Game Of Active Directory', url: 'https://github.com/Orange-Cyberdefense/GOAD' }, { title: 'DetectionLab (archived, still a great reference)', url: 'https://github.com/clong/DetectionLab' }, { title: 'Atomic Red Team', url: 'https://github.com/redcanaryco/atomic-red-team' }, { title: 'FLARE-VM', url: 'https://github.com/mandiant/flare-vm' }],
  nodes: [
    N('kali', 'Kali attacker', 'attacker', 'Red team', C.red, [-15, -4], [3.6, 3.2], 'The attacker box inside the range.', 'Offence is the best teacher for defence. It only ever exists inside this network.', ['Kali Linux', 'Recon & exploitation tooling', 'Attack playbooks'], { lesson: 'Keep attack tooling out of production networks.' }),
    N('c2', 'C2 server', 'attacker', 'Red team', C.red, [-15, 4], [3.6, 3.2], 'A command-and-control server and redirector.', 'Lets me practise beacons, redirectors and C2 detection, and see exactly what they look like on the wire.', ['C2 framework', 'Redirector', 'Beacon traffic']),
    N('rfw', 'Range firewall', 'firewall', 'Range edge', C.warm, [-8, 0], [4.2, 3.4], 'Controls what the range can reach.', 'Keeps the exercise contained and lets me turn parts of the network on and off to practise segmentation.', ['Firewall rules', 'Logging', 'VLAN gateways']),
    N('web', 'Exposed web app', 'ws', 'Range DMZ', C.warm, [-2, 9], [3.6, 3.2], 'A deliberately vulnerable public-facing app.', 'The initial foothold. Compromising it is the first step of the exercise and the first thing a defender should spot.', ['Vulnerable web app', 'Web logs', 'Reverse shell target']),
    N('srv', 'SRV01 (file / SQL)', 'dc', 'Domain', C.ad, [0, 5], [3.6, 3.2], 'A member server holding data and credentials.', 'The pivot point: reachable from the foothold, trusted by the domain, and full of interesting loot.', ['File shares', 'SQL Server', 'Service accounts']),
    N('dc1', 'DC01 (root domain)', 'dc', 'Domain', C.ad, [3, -6], [3.6, 3.2], 'The forest root domain controller.', 'The crown jewels. Kerberos, replication and group policy attacks all land here.', ['Active Directory', 'DNS', 'Kerberos', 'Group Policy']),
    N('dc2', 'DC02 (child domain)', 'dc', 'Domain', C.ad, [9, -3], [3.6, 3.2], 'A child domain controller with a forest trust.', 'Trusts are where lateral movement across domains happens, which is why they get their own exercise.', ['Child domain', 'Forest trust', 'Replication']),
    N('ws1', 'WS01', 'ws', 'Domain', C.ad, [4, 2], [3.2, 2.8], 'Windows workstation with a logged-in user.', 'Where phishing lands and credentials get dumped.', ['Windows 10/11', 'Sysmon', 'EDR agent']),
    N('ws2', 'WS02', 'ws', 'Domain', C.ad, [8, 3], [3.2, 2.8], 'Second workstation, different privileges.', 'Gives lateral movement somewhere to go.', ['Windows client', 'Local admin paths']),
    N('ws3', 'WS03', 'ws', 'Domain', C.ad, [12, 4], [3.2, 2.8], 'Third workstation in the child domain.', 'Reached across the trust.', ['Windows client']),
    N('sensor', 'Network sensor', 'siem', 'Blue team', C.net, [14, -8], [3.4, 3], 'Passive monitoring on a mirror port.', 'Defenders need the packet view too: this is where C2 beacons and lateral movement show up.', ['Zeek / Suricata', 'PCAP capture', 'Forwards to SIEM']),
  ],
  links: [L('kali', 'rfw', 'Attacks in', 'public'), L('c2', 'rfw', 'Beacons', 'public'), L('rfw', 'web', 'Published service', 'public'), L('web', 'srv', 'Pivot'), L('srv', 'dc1', 'Credential theft'), L('dc1', 'dc2', 'Forest trust'),
    L('ws1', 'dc1', 'Domain join'), L('ws2', 'dc1', 'Domain join'), L('ws3', 'dc2', 'Domain join'), L('srv', 'ws1', 'SMB'), L('sensor', 'dc1', 'Mirror port', 'light'), L('sensor', 'srv', 'Mirror port', 'light')],
};

// ============================================================ MAP 3: MALWARE ZOO
const ROLES = [
  { role: 'Detonation', color: '#ff4d5e', blurb: 'Runs a sample while everything is recorded, then gets reverted to a clean snapshot.' },
  { role: 'Analysis tooling', color: '#ffb02e', blurb: 'Disassemblers, unpackers and scripts for taking a sample apart.' },
  { role: 'Bot / C2 simulation', color: '#b36bff', blurb: 'Stand-ins for command servers so samples have something to talk to.' },
  { role: 'Capture & triage', color: '#38d6ff', blurb: 'Collects traffic, process and file telemetry for each run.' },
];
const zooNodes: LabNode[] = [
  N('zhub', 'Zoo VLAN switch', 'switch', 'Isolated VLAN', '#ff4d5e', [0, 0], [4.4, 3], 'The isolated network that joins the zoo.', 'No gateway, no DNS to the real world. Everything the samples can see is fake.', ['Isolated VLAN', 'No default route', 'Port mirroring'], { lesson: 'The zoo never gets a default gateway. Fake the internet instead of routing out.' }),
  N('inetsim', 'INetSim (fake internet)', 'siem', 'Services', '#ffb02e', [-10, 0], [3.8, 3.2], 'Pretends to be the internet.', 'Malware that phones home gets a convincing answer from DNS, HTTP and SMTP, so it shows its behaviour without ever reaching a real server.', ['Fake DNS / HTTP / SMTP', 'Request logging']),
  N('tap', 'Traffic capture', 'siem', 'Services', '#38d6ff', [-10, -7], [3.8, 3.2], 'Records every packet the zoo sends.', 'Network IOCs come straight from the capture: domains, IPs, protocols and timing.', ['PCAP capture', 'Zeek / Suricata']),
  N('snap', 'Snapshot store', 'storage', 'Storage', '#7ad7ff', [-10, 7], [3.8, 3.2], 'Clean golden images and run results.', 'Every container goes back to a known-good state after each run. Part of the 10 TB array lives here.', ['Golden snapshots', 'Sample archive', 'Reports']),
  N('host', 'Dell R620', 'server', 'Hypervisor', '#38d6ff', [-10, -14], [5.4, 3.6], 'The host that runs all 20 containers.', 'Containers share the host kernel, which is why the zoo stays strictly air-gapped and the host is watched closely.', ['Proxmox', '20 LXC containers', 'Resource limits'], { lesson: 'Containers share a kernel with the host. Treat the zoo as dangerous and keep it air-gapped.' }),
];
const lxcNodes: LabNode[] = Array.from({ length: 20 }, (_, i) => {
  const row = Math.floor(i / 4), col = i % 4;
  const r = row < 2 ? ROLES[0] : ROLES[row - 1];
  const num = 101 + i;
  return N(`lxc${num}`, `lxc-${num}`, 'lxc', r.role, r.color, [5 + col * 3.4, -7 + row * 3.4], [2.6, 2.6], `${r.role} container.`, r.blurb, ['LXC container', 'Isolated VLAN', 'Snapshot / revert']);
});
const zoo: LabMap = {
  id: 'zoo', num: '03', name: 'Malware Zoo', tag: '20 LXC, air-gapped', center: [2, -2],
  brief: 'Twenty LXC containers on an isolated VLAN with no route to anything. Samples run against a fake internet while every packet is captured, then everything reverts to a clean snapshot.',
  budget: { cores: 16, ramGB: 48, diskTB: 1.5 },
  rules: ['No default gateway. If it can route out, it is not a zoo.', 'Fake the internet with INetSim; never let a sample reach a real server.', 'Snapshot before, revert after. Always.', 'Containers share the host kernel: keep the host patched, and keep Windows samples in full VMs, not here.'],
  learn: [{ title: 'INetSim', url: 'https://www.inetsim.org' }, { title: 'REMnux (Linux toolkit for malware analysis)', url: 'https://remnux.org' }, { title: 'CAPEv2 sandbox', url: 'https://github.com/kevoreilly/CAPEv2' }, { title: 'Proxmox: Linux Container (LXC)', url: 'https://pve.proxmox.com/wiki/Linux_Container' }],
  nodes: [...zooNodes, ...lxcNodes],
  links: [
    L('host', 'zhub', 'Hosts, one-way', 'isolated'), L('zhub', 'inetsim', 'Fake internet'), L('zhub', 'tap', 'Mirror', 'light'), L('snap', 'zhub', 'Revert', 'light'),
    ...lxcNodes.map((n) => L('zhub', n.id, '', 'light')),
  ],
};

// ============================================================ MAP 4: SOC / DFIR + AI
const soc: LabMap = {
  id: 'soc', num: '04', name: 'SOC / DFIR + AI', tag: 'Detect, investigate, automate', center: [2, 0],
  brief: 'Endpoints report to Velociraptor, detections are written as Sigma rules in Git, a SIEM correlates everything, and a swarm of LangChain agents helps triage the alerts.',
  budget: { cores: 14, ramGB: 64, diskTB: 4 },
  rules: ['Detections are code: version them, review them, test them.', 'Hunt on endpoints with Velociraptor, then confirm with logs.', 'Keep an evidence store that is separate from the systems you investigate.', 'AI agents assist; a human decides. Log what every agent did.'],
  learn: [{ title: 'Velociraptor docs', url: 'https://docs.velociraptor.app' }, { title: 'Sigma rules (SigmaHQ)', url: 'https://github.com/SigmaHQ/sigma' }, { title: 'Security Onion', url: 'https://docs.securityonion.net' }, { title: 'Wazuh', url: 'https://documentation.wazuh.com' }, { title: 'LangChain docs', url: 'https://docs.langchain.com' }, { title: 'LangGraph (multi-agent)', url: 'https://langchain-ai.github.io/langgraph/' }],
  nodes: [
    N('eps', 'Endpoints', 'ws', 'Monitored', C.ad, [-15, -5], [3.8, 3.2], 'Windows and Linux machines that report in.', 'Real telemetry has to come from somewhere. Every endpoint runs the Velociraptor client and Sysmon.', ['Velociraptor client', 'Sysmon / auditd', 'Log forwarder']),
    N('vr', 'Velociraptor server', 'siem', 'DFIR', C.net, [-8, -5], [3.8, 3.2], 'Endpoint hunting and live forensics.', 'Run a query across every endpoint at once: collect artifacts, hunt for indicators and grab triage packages during an incident.', ['Velociraptor', 'Hunts & artifacts', 'Triage collection']),
    N('siem', 'SIEM / log store', 'siem', 'Detection', C.gold, [0, 0], [4, 3.4], 'Where every log ends up.', 'Correlation across sources is where weak signals become alerts. It is also the data that Sigma rules and the AI agents work from.', ['Log ingestion', 'Dashboards', 'Alerting']),
    N('sigma', 'Sigma rule pipeline', 'dev', 'Detection', C.gold, [-8, 2], [3.8, 3.2], 'Detection rules written once, translated for any SIEM.', 'Sigma keeps detections portable and testable. Rules are written, tested against attack simulations and shipped through Git.', ['Sigma rules', 'Rule tests', 'Backend conversion']),
    N('gitd', 'Gitea (detections as code)', 'git', 'Dev VLAN', C.gold, [-8, 8], [3.8, 3.2], 'Where the rules live.', 'Pull requests and CI for detections: every rule is reviewed and tested before it fires in anger.', ['Gitea', 'CI pipeline', 'Rule review']),
    N('dfir', 'DFIR workstation', 'ws', 'Investigation', C.net, [0, -8], [3.8, 3.2], 'Where cases get worked.', 'Memory, disk and timeline analysis happen here, with evidence mounted read-only from the evidence store.', ['Memory & disk forensics', 'Timelines', 'Reporting']),
    N('evid', 'Evidence store', 'storage', 'Evidence', '#7ad7ff', [8, -8], [3.8, 3.2], 'Write-once storage for cases (part of the 10 TB).', 'Evidence is kept apart from the systems under investigation, hashed, and never worked on directly.', ['Hashed evidence', 'Read-only mounts', 'Backups']),
    N('swarm', 'AI agent swarm', 'ai', 'Agents', C.ai, [7, 5], [4.4, 3.6], 'A team of LangChain agents that help triage alerts.', 'Agents enrich alerts, pull related logs, summarise what happened and suggest next steps, so an analyst starts from a briefing instead of a raw alert.', ['LangChain agents', 'Tool-calling', 'Alert triage', 'Investigation summaries']),
    N('vec', 'Vector memory', 'storage', 'Agents', C.ai, [14, 2], [3.4, 3], 'Searchable memory for the agents.', 'Past cases, rule notes and playbooks are embedded here so agents recall how similar incidents were handled.', ['Vector database', 'Case notes', 'Playbooks']),
    N('llm', 'Model gateway', 'dev', 'Agents', C.ai, [14, 8], [3.4, 3], 'One entry point to the language models.', 'Centralises keys, rate limits and logging, and keeps sensitive log data from leaking to places it should not go.', ['API gateway', 'Prompt logging', 'Rate limits'], { lesson: 'Log every prompt and tool call. An agent you cannot audit is a liability.' }),
  ],
  links: [L('eps', 'vr', 'Client check-in'), L('vr', 'siem', 'Artifacts'), L('eps', 'siem', 'Logs', 'light'), L('sigma', 'siem', 'Detection rules', 'admin'), L('gitd', 'sigma', 'CI / PRs', 'admin'), L('vr', 'dfir', 'Triage packages'),
    L('dfir', 'evid', 'Evidence'), L('siem', 'swarm', 'Alerts'), L('swarm', 'vec', 'Memory'), L('swarm', 'llm', 'Model calls'), L('swarm', 'dfir', 'Briefings', 'admin')],
};

// ============================================================ MAP 5: MOBILE & MACOS
const mobile: LabMap = {
  id: 'mobile', num: '05', name: 'Mobile & macOS', tag: 'Research bench', center: [0, 0],
  brief: 'Android emulators and real devices, an iOS bench, and a docker-OSX macOS box, all behind an intercepting proxy, for reverse engineering apps and testing how devices leak.',
  budget: { cores: 8, ramGB: 40, diskTB: 1 },
  rules: ['Test devices are never signed into personal accounts.', 'All app traffic goes through the intercepting proxy.', 'Treat research devices as compromised by default: wipe and re-flash between jobs.', 'Keep samples and firmware images on the isolated store, not on your daily machine.'],
  learn: [{ title: 'Docker-OSX', url: 'https://github.com/sickcodes/Docker-OSX' }, { title: 'Frida docs', url: 'https://frida.re/docs/home/' }, { title: 'mitmproxy', url: 'https://mitmproxy.org' }, { title: 'OWASP MASTG (mobile testing guide)', url: 'https://mas.owasp.org/MASTG/' }],
  nodes: [
    N('dosx', 'docker-OSX box', 'mac', 'macOS', C.mac, [-7, -5], [4, 3.4], 'A macOS environment running in a container.', 'Needed for Xcode, iOS tooling and macOS research without buying more hardware. Snapshotted like everything else.', ['docker-OSX (KVM)', 'Xcode tooling', 'iOS research tools'], { lesson: 'Run it on its own VLAN and keep it patched and off personal accounts.' }),
    N('emu', 'Android emulators', 'android', 'Android', C.and, [-7, 5], [4, 3.4], 'A farm of Android virtual devices.', 'Quick, resettable test devices for APK analysis, dynamic testing and CVE hunting.', ['Android emulators', 'Rooted images', 'Frida server']),
    N('dev1', 'Physical Android devices', 'android', 'Android', C.and, [-14, 5], [4, 3.4], 'Real hardware for things emulators hide.', 'Some bugs only show on real hardware: sensors, secure elements, vendor builds.', ['Test phones', 'ADB over network', 'Rooting tools']),
    N('ios', 'iOS research bench', 'phone', 'iOS', C.mac, [-14, -5], [4, 3.4], 'Bench devices for iOS security work.', 'Bootchain, Secure Enclave and kernel research need real devices that can be restored at will.', ['Research devices', 'Restore tooling', 'Jailbreak research']),
    N('proxy', 'Intercepting proxy', 'dev', 'Analysis', C.net, [0, 0], [3.8, 3.2], 'mitmproxy and Frida in the middle.', 'See exactly what every app sends and receives, and hook the code that sends it.', ['mitmproxy', 'Frida / objection', 'Traffic logs'], { lesson: 'Route test devices through the proxy and nowhere else.' }),
    N('mfw', 'Mobile VLAN firewall', 'firewall', 'Perimeter', C.warm, [7, 0], [4.2, 3.4], 'Gives test devices only what they need.', 'Keeps research devices away from the rest of the lab while still letting the proxy and update servers through.', ['VLAN gateway', 'Filtered egress']),
    N('cf', 'Counter-forensics laptop', 'laptop', 'Workstation', C.pub, [7, -7], [4.4, 3.4], 'The battle-damaged Lenovo again, in its research role.', 'Anti-forensics and counterintelligence work needs a machine that can be wiped, imaged and rebuilt without regret.', ['Anti-forensics experiments', 'Imaging & wiping', 'Tor testing']),
    N('samples', 'Sample & firmware store', 'storage', 'Isolated', '#7ad7ff', [7, 7], [3.8, 3.2], 'Where APKs, IPAs and images are kept.', 'Everything under test is archived and hashed so findings can be reproduced later.', ['APK / IPA archive', 'Firmware images', 'Hashes']),
    N('net2', 'Internet (filtered)', 'cloud', 'Outside', C.sky, [14, 0], [3.2, 3.2], 'Egress for updates and app servers.', 'Only reached through the firewall and the proxy.', ['Filtered egress']),
  ],
  links: [L('dosx', 'proxy', 'Traffic'), L('emu', 'proxy', 'Traffic'), L('dev1', 'proxy', 'Traffic'), L('ios', 'proxy', 'Traffic'), L('proxy', 'mfw', 'Egress'), L('mfw', 'net2', 'Filtered', 'public'),
    L('emu', 'samples', 'APKs', 'light'), L('dosx', 'samples', 'IPAs', 'light'), L('cf', 'mfw', 'Own VLAN', 'light')],
};

export const MAPS: LabMap[] = [net, range, zoo, soc, mobile];

// ============================================================ BUILDER
export const PALETTE = [
  { kind: 'cloud', label: 'Internet (WAN)', color: '#8fb8ff', hint: 'The outside world. Attackers start here.' },
  { kind: 'firewall', label: 'Firewall', color: '#ffb02e', hint: 'OPNsense / pfSense. The only thing the WAN plugs into.' },
  { kind: 'switch', label: 'VLAN switch', color: '#38d6ff', hint: 'Keeps zones apart at layer 2.' },
  { kind: 'vpn', label: 'WireGuard / Tailscale', color: '#4af0a2', hint: 'The only safe way in for admins.' },
  { kind: 'server', label: 'Proxmox host', color: '#38d6ff', hint: 'Runs the ranges. Management must be private.' },
  { kind: 'tor', label: 'Tor relay', color: '#b36bff', hint: 'Belongs in the DMZ.' },
  { kind: 'git', label: 'Gitea', color: '#ffe14a', hint: 'Private. Behind the VPN.' },
  { kind: 'siem', label: 'SIEM / logging', color: '#ffe14a', hint: 'See everything.' },
  { kind: 'storage', label: 'Storage / backups', color: '#7ad7ff', hint: 'Snapshots and restores.' },
  { kind: 'ws', label: 'Workstation / AD', color: '#5b8cff', hint: 'A Windows box in a domain.' },
  { kind: 'lxc', label: 'Malware LXC', color: '#ff4d5e', hint: 'Only ever in the isolated range.' },
  { kind: 'attacker', label: 'Attacker (Kali)', color: '#ff4d5e', hint: 'Red team tooling: range only.' },
  { kind: 'mac', label: 'docker-OSX box', color: '#c9d3dc', hint: 'macOS research.' },
  { kind: 'android', label: 'Android device', color: '#3ddc84', hint: 'Test phones and emulators.' },
  { kind: 'ai', label: 'AI agent swarm', color: '#e04aff', hint: 'Keep it behind the VPN and log its actions.' },
];
export const ZONES = [
  { id: 'wan', label: 'WAN / Internet', color: '#8fb8ff', x: -22, w: 6 },
  { id: 'dmz', label: 'DMZ', color: '#b36bff', x: -13, w: 8 },
  { id: 'lan', label: 'LAN / production', color: '#38d6ff', x: -3, w: 10 },
  { id: 'mgmt', label: 'Management', color: '#4af0a2', x: 7, w: 8 },
  { id: 'range', label: 'Isolated range', color: '#ff4d5e', x: 16, w: 9 },
] as const;
