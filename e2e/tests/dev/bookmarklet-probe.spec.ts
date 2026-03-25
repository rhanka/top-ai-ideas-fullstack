import { test, expect, chromium } from '@playwright/test';
import http from 'http';

/**
 * Bookmarklet iframe probe test — verifies that the bridge-probe-ack
 * postMessage handshake works on real sites (Gmail, Outlook, matchid.io, LinkedIn).
 *
 * Connects to the user's Chromium via CDP (localhost:9222, forwarded to 9223 for Docker).
 */

const SITES = [
  { name: 'Gmail', hostname: 'mail.google.com' },
  { name: 'Outlook', hostname: 'outlook.cloud.microsoft' },
  { name: 'matchid.io', hostname: 'deces.matchid.io' },
  { name: 'LinkedIn', hostname: 'www.linkedin.com' },
];

const BRIDGE_ORIGIN = 'http://localhost:5173';

/**
 * Minimal probe that mirrors the bookmarklet bootstrap logic:
 * 1. Create iframe to /bookmarklet-bridge-probe
 * 2. Listen for postMessage bridge-probe-ack
 * 3. Return { iframeOk, elapsed }
 */
function makeProbeScript(bridgeOrigin: string): string {
  return `
    new Promise(function(outerResolve) {
      var probeUrl = ${JSON.stringify(bridgeOrigin + '/bookmarklet-bridge-probe')};
      var pf = document.createElement("iframe");
      pf.style.cssText = "display:none;width:0;height:0;border:none;position:absolute;";
      pf.src = probeUrl;

      var iframeOk = false;
      var start = Date.now();
      var probeResolve = null;
      var probePromise = new Promise(function(resolve) { probeResolve = resolve; });

      function onProbeMsg(evt) {
        if (evt.data && evt.data.type === "bridge-probe-ack") {
          iframeOk = true;
          probeResolve();
        }
      }
      window.addEventListener("message", onProbeMsg);
      document.body.appendChild(pf);

      var timeout = new Promise(function(resolve) { setTimeout(resolve, 8000); });
      Promise.race([probePromise, timeout]).then(function() {
        window.removeEventListener("message", onProbeMsg);
        try { pf.remove(); } catch(_) {}
        outerResolve({ iframeOk: iframeOk, elapsed: Date.now() - start });
      });
    })
  `;
}

test.describe('Bookmarklet iframe probe on live sites', () => {
  test.use({ storageState: undefined });
  test.setTimeout(120_000);

  test('bridge-probe-ack received on target sites', async () => {
    // Get CDP websocket URL
    const wsUrl = await new Promise<string>((resolve, reject) => {
      http.get(
        'http://host.docker.internal:9223/json/version',
        { headers: { Host: 'localhost:9222' } },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const info = JSON.parse(data);
            const url = info.webSocketDebuggerUrl
              .replace(/127\.0\.0\.1|localhost/, 'host.docker.internal')
              .replace(':9222', ':9223');
            resolve(url);
          });
        },
      ).on('error', reject);
    });

    console.log('Connecting via CDP:', wsUrl);
    const browser = await chromium.connectOverCDP(wsUrl, { timeout: 60_000 });
    const context = browser.contexts()[0];
    const pages = context.pages();
    console.log(`Connected. ${pages.length} pages found.`);

    const results: Array<{ site: string; found: boolean; iframeOk: boolean; elapsed: number; error?: string }> = [];

    for (const site of SITES) {
      const page = pages.find((p) => {
        try {
          return p.url().includes(site.hostname);
        } catch {
          return false;
        }
      });

      if (!page) {
        console.log(`  [${site.name}] Tab not found, skipping`);
        results.push({ site: site.name, found: false, iframeOk: false, elapsed: 0, error: 'tab not found' });
        continue;
      }

      try {
        const probeCode = makeProbeScript(BRIDGE_ORIGIN);
        const result = await page.evaluate(probeCode) as { iframeOk: boolean; elapsed: number };
        console.log(`  [${site.name}] iframeOk=${result.iframeOk} elapsed=${result.elapsed}ms`);
        results.push({ site: site.name, found: true, iframeOk: result.iframeOk, elapsed: result.elapsed });
      } catch (err: any) {
        console.log(`  [${site.name}] ERROR: ${err.message}`);
        results.push({ site: site.name, found: true, iframeOk: false, elapsed: 0, error: err.message });
      }
    }

    await browser.close();

    // Summary
    console.log('\n--- RESULTS ---');
    for (const r of results) {
      const status = !r.found ? 'SKIP' : r.iframeOk ? 'PASS' : 'FAIL';
      console.log(`  ${status} ${r.site} (${r.elapsed}ms) ${r.error ?? ''}`);
    }

    // Assert: all found sites must have iframeOk = true
    const testedSites = results.filter((r) => r.found);
    expect(testedSites.length, 'At least one site tab must be found').toBeGreaterThan(0);
    for (const r of testedSites) {
      expect(r.iframeOk, `${r.site}: bridge-probe-ack should be received`).toBe(true);
    }
  });
});
