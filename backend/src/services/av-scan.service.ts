import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { config } from '../config/env';

type ScanResult = { ok: true } | { ok: false; message: string };

type ClamScanInstance = {
  scanFile: (filePath: string) => Promise<{ isInfected: boolean; viruses?: string[] }>;
};

let clamscanInstance: ClamScanInstance | null = null;
let clamscanFailed = false;

async function getClamScan(): Promise<ClamScanInstance | null> {
  if (clamscanInstance) return clamscanInstance;
  if (clamscanFailed) return null;
  if (!config.avScan.enabled) return null;
  const hasSocket = Boolean(config.avScan.socket?.trim());
  const hasTcp = Boolean(config.avScan.host?.trim());
  if (!hasSocket && !hasTcp) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NodeClam = require('clamscan');
    const options: Record<string, unknown> = {
      removeInfected: false,
      quarantineInfected: false,
      scanLog: null,
      debugMode: false,
      clamdscan: {
        socket: hasSocket ? config.avScan.socket : undefined,
        host: hasTcp ? config.avScan.host : undefined,
        port: hasTcp ? config.avScan.port : undefined,
        timeout: config.avScan.timeout,
      },
    };
    const resolved = await NodeClam().init(options);
    clamscanInstance = resolved;
    return clamscanInstance;
  } catch (err) {
    clamscanFailed = true;
    console.warn('AV scan: clamscan not available (install with: npm install clamscan).', err);
    return null;
  }
}

/**
 * Scan a file buffer with ClamAV (writes to temp file, then scanFile).
 * If scanning is disabled or unavailable, returns { ok: true }.
 */
export async function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  const scanner = await getClamScan();
  if (!scanner) return { ok: true };

  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `av-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    await fs.writeFile(tmpPath, buffer);
    const result = await scanner.scanFile(tmpPath);
    const infected = result?.isInfected === true;
    if (infected) {
      const viruses = result?.viruses?.join(', ') || 'unknown';
      return { ok: false, message: `File failed security scan: ${viruses}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('AV scan error:', message);
    return { ok: true };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
