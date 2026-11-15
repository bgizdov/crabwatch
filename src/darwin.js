// macOS process access: no /proc, so CPU time and elapsed time come from `ps`, and cwd from `lsof`.
import { execFileSync } from 'node:child_process';

// "[dd-][hh:]mm:ss[.cc]" -> seconds (may be fractional).
function parseDuration(text) {
  const m = String(text).trim().match(/^(?:(\d+)-)?((?:\d+:)*\d+(?:\.\d+)?)$/);
  if (!m) return 0;
  const days = Number(m[1] ?? 0);
  const secs = m[2].split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
  return days * 86400 + secs;
}

export const parseEtime = (text) => Math.round(parseDuration(text));

// CPU time in centiseconds, so it can be used as ticks with hz = 100.
export const parseCpuTime = (text) => Math.round(parseDuration(text) * 100);

export const DARWIN_HZ = 100;

export function parseDarwinPs(text) {
  return text
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, etime, time, comm, args]) => ({
      pid: Number(pid), ppid: Number(ppid), etimes: parseEtime(etime), ticks: parseCpuTime(time), comm, args,
    }));
}

// Parses `lsof -F pn` output: "p<pid>" starts a process, "n<path>" is the file name.
export function parseLsofCwd(text) {
  const out = new Map();
  let pid = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && pid !== null && !out.has(pid)) out.set(pid, line.slice(1));
  }
  return out;
}

export function listDarwinProcs() {
  const out = execFileSync('ps', ['-axo', 'pid=,ppid=,etime=,time=,ucomm=,args='], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return parseDarwinPs(out);
}

export function darwinCwds(pids) {
  if (pids.length === 0) return new Map();
  try {
    const out = execFileSync('lsof', ['-a', '-d', 'cwd', '-p', pids.join(','), '-F', 'pn'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseLsofCwd(out);
  } catch (err) {
    // lsof exits 1 when some pids vanished but still prints the rest.
    return parseLsofCwd(typeof err.stdout === 'string' ? err.stdout : '');
  }
}
