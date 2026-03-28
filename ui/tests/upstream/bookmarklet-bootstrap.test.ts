import { describe, expect, it } from 'vitest';
import { generateBookmarkletBootstrap } from '../../src/lib/upstream/bookmarklet-bootstrap';

describe('generateBookmarkletBootstrap', () => {
  const BRIDGE_URL = 'https://app.topai.com/bookmarklet-bridge?nonce=abc123';
  const SCRIPT_CONTENT = '(function(){console.log("injected")})();';
  const UI_ORIGIN = 'https://app.topai.com';
  const API_ORIGIN = 'https://api.topai.com';

  const bootstrap = generateBookmarkletBootstrap(BRIDGE_URL, SCRIPT_CONTENT, UI_ORIGIN, API_ORIGIN);

  it('returns a javascript: bookmarklet string', () => {
    expect(bootstrap.startsWith('javascript:void(')).toBe(true);
    expect(bootstrap.endsWith(')')).toBe(true);
  });

  it('contains the re-entrant guard', () => {
    expect(bootstrap).toContain('__TOPAI_ACTIVE');
  });

  // --- TrustedTypes bypass ---

  it('attempts TrustedTypes policy creation with "topai" name first', () => {
    expect(bootstrap).toContain('trustedTypes.createPolicy("topai"');
  });

  it('tries hardcoded common TT policy names as fallback', () => {
    const commonNames = [
      'dompurify',
      'domPurifyHTML',
      'emptyStringPolicyHTML',
      'sanitizer',
      'safehtml',
      'lit-html',
      'highcharts',
      'goog#html',
      'jSecure',
      'default',
    ];
    for (const name of commonNames) {
      expect(bootstrap).toContain(name);
    }
  });

  it('TT fallback names are tried in a loop', () => {
    // The bootstrap should contain a for loop over the names array
    expect(bootstrap).toContain('for(var i=0;i<names.length;i++)');
    expect(bootstrap).toContain('trustedTypes.createPolicy(names[i]');
  });

  it('TT policy provides createHTML, createScriptURL, createScript handlers', () => {
    expect(bootstrap).toContain('createHTML');
    expect(bootstrap).toContain('createScriptURL');
    expect(bootstrap).toContain('createScript');
  });

  // --- Inline script probe ---

  it('performs inline script probe', () => {
    expect(bootstrap).toContain('__TOPAI_INLINE_PROBE');
    expect(bootstrap).toContain('ps.textContent');
  });

  it('inline probe uses TT policy if available', () => {
    expect(bootstrap).toContain('tp?tp.createScript(');
  });

  it('cleans up inline probe marker', () => {
    expect(bootstrap).toContain('delete window.__TOPAI_INLINE_PROBE');
  });

  // --- Iframe probe ---

  it('creates iframe probe to /bookmarklet-bridge-probe', () => {
    expect(bootstrap).toContain('/bookmarklet-bridge-probe');
  });

  it('uses postMessage handshake for iframe probe (bridge-probe-ack)', () => {
    expect(bootstrap).toContain('bridge-probe-ack');
  });

  it('iframe probe has 3s timeout', () => {
    expect(bootstrap).toContain('setTimeout(r,3000)');
  });

  it('uses TT policy for iframe src if available', () => {
    expect(bootstrap).toContain('tp?tp.createScriptURL(probeUrl):probeUrl');
  });

  // --- Strategy selection ---

  it('strategy: iframe + inline -> creates bridge iframe and inline script', () => {
    expect(bootstrap).toContain('if(iframeOk&&inlineOk)');
    expect(bootstrap).toContain('f.id="__topai_bridge"');
  });

  it('strategy: iframe + external -> loads script via src when external probe succeeds', () => {
    expect(bootstrap).toContain('if(iframeOk&&externalOk)');
    expect(bootstrap).toContain('/api/v1/bookmarklet/injected-script.js');
    expect(bootstrap).toContain('data-bridge-origin');
  });

  // --- External script probe ---

  it('performs external script probe via script onload/onerror', () => {
    expect(bootstrap).toContain('/api/v1/bookmarklet/probe.js');
    expect(bootstrap).toContain('externalOk=true');
    expect(bootstrap).toContain('eps.onload');
    expect(bootstrap).toContain('eps.onerror');
  });

  it('external probe uses TT policy for script src if available', () => {
    expect(bootstrap).toContain('tp?tp.createScriptURL(extProbeUrl):extProbeUrl');
  });

  // --- Executor+iframe strategy ---

  it('strategy: executor+iframe when iframe OK but both inline and external blocked', () => {
    // The condition is simply iframeOk (after inline+iframe and external+iframe)
    expect(bootstrap).toContain('}else if(iframeOk){');
  });

  it('executor+iframe sets __TOPAI_ACTIVE guard', () => {
    expect(bootstrap).toContain('window.__TOPAI_ACTIVE=true');
  });

  it('executor+iframe creates bridge iframe', () => {
    // The executor branch also creates the bridge iframe
    expect(bootstrap).toContain('f.id="__topai_bridge"');
  });

  it('executor+iframe creates a badge with Connecting state', () => {
    expect(bootstrap).toContain('badge.id="__topai_badge"');
    expect(bootstrap).toContain('badge.textContent="Connecting..."');
  });

  it('executor+iframe includes truncate utility', () => {
    expect(bootstrap).toContain('function truncate(str,maxLen)');
  });

  it('executor+iframe includes tab_read handler with DOM read', () => {
    expect(bootstrap).toContain('function handleTabRead(callId,args)');
    expect(bootstrap).toContain('document.querySelector(selector)');
    expect(bootstrap).toContain('el.outerHTML');
    expect(bootstrap).toContain('el.textContent');
  });

  it('executor+iframe includes tab_action handler with click/input/scroll', () => {
    expect(bootstrap).toContain('function handleTabAction(callId,args)');
    expect(bootstrap).toContain('el.click()');
    expect(bootstrap).toContain('action==="input"');
    expect(bootstrap).toContain('action==="scroll"');
  });

  it('executor+iframe sends results via postMessage to bridge', () => {
    expect(bootstrap).toContain('function sendResult(callId,result)');
    expect(bootstrap).toContain('type:"tool_result"');
  });

  it('executor+iframe listens for commands via postMessage from bridge', () => {
    expect(bootstrap).toContain('d.type==="command"');
    expect(bootstrap).toContain('d.type==="connected"');
  });

  it('executor+iframe registers with bridge on iframe load', () => {
    expect(bootstrap).toContain('type:"register"');
    expect(bootstrap).toContain('url:location.href');
    expect(bootstrap).toContain('title:document.title');
  });

  it('executor+iframe shows badge connected state on "connected" message', () => {
    expect(bootstrap).toContain('Top AI \\u2713');
    expect(bootstrap).toContain('#22c55e');
  });

  it('executor+iframe handles beforeunload with disconnected badge', () => {
    expect(bootstrap).toContain('badge.textContent="Disconnected"');
  });

  it('executor+iframe verifies message origin', () => {
    expect(bootstrap).toContain('ev.origin!==BRIDGE_ORIGIN');
  });

  it('strategy: JSONP fallback when iframe blocked but inline works', () => {
    expect(bootstrap).toContain('}else if(inlineOk){');
    expect(bootstrap).toContain('__TOPAI_JSONP_MODE');
    expect(bootstrap).toContain('__TOPAI_API_ORIGIN');
  });

  it('strategy: all blocked -> shows extension install badge', () => {
    expect(bootstrap).toContain('Installez l');
    expect(bootstrap).toContain('extension Chrome');
  });

  // --- Strategy fallback order ---

  it('strategy fallback order: inline+iframe > external+iframe > executor+iframe > jsonp > blocked', () => {
    const inlineIdx = bootstrap.indexOf('if(iframeOk&&inlineOk)');
    const externalIdx = bootstrap.indexOf('if(iframeOk&&externalOk)');
    const executorIdx = bootstrap.indexOf('}else if(iframeOk){');
    const jsonpIdx = bootstrap.indexOf('}else if(inlineOk){');
    const blockedIdx = bootstrap.indexOf('}else{', jsonpIdx);
    // Ensure all strategies are present and in order
    expect(inlineIdx).toBeGreaterThan(-1);
    expect(externalIdx).toBeGreaterThan(inlineIdx);
    expect(executorIdx).toBeGreaterThan(externalIdx);
    expect(jsonpIdx).toBeGreaterThan(executorIdx);
    expect(blockedIdx).toBeGreaterThan(jsonpIdx);
  });

  // --- Probes wait for all results ---

  it('waits for both external and iframe probes via Promise.all', () => {
    expect(bootstrap).toContain('Promise.all([extProbePromise,Promise.race([probePromise,timeout])');
  });

  // --- No popup/window.open ---

  it('does NOT contain window.open or popup references', () => {
    expect(bootstrap).not.toContain('window.open');
    expect(bootstrap).not.toContain('popup');
  });

  // --- Embeds the provided URLs ---

  it('embeds the bridge URL', () => {
    expect(bootstrap).toContain(BRIDGE_URL);
  });

  it('embeds the script content (JSON-encoded)', () => {
    // The script content is JSON.stringify'd inside the bootstrap, so quotes are escaped
    expect(bootstrap).toContain(JSON.stringify(SCRIPT_CONTENT));
  });

  it('embeds the UI origin for bridge routes', () => {
    expect(bootstrap).toContain(UI_ORIGIN + '/bookmarklet-bridge-probe');
  });

  it('embeds the API origin for API endpoints', () => {
    expect(bootstrap).toContain(API_ORIGIN + '/api/v1/bookmarklet/probe.js');
    expect(bootstrap).toContain(API_ORIGIN + '/api/v1/bookmarklet/injected-script.js');
  });

  // --- Different inputs produce different outputs ---

  it('generates different bootstrap for different bridge URLs', () => {
    const other = generateBookmarkletBootstrap(
      'https://other.com/bridge',
      SCRIPT_CONTENT,
      'https://other.com',
      'https://api-other.com',
    );
    expect(other).not.toBe(bootstrap);
    expect(other).toContain('https://other.com/bridge');
  });

  it('uses UI origin for bridge-related URLs and API origin for API endpoints', () => {
    const b = generateBookmarkletBootstrap(
      'http://localhost:5173/bookmarklet-bridge?nonce=test',
      SCRIPT_CONTENT,
      'http://localhost:5173',
      'http://localhost:8787',
    );
    // Bridge probe uses UI origin
    expect(b).toContain('http://localhost:5173/bookmarklet-bridge-probe');
    // API endpoints use API origin
    expect(b).toContain('http://localhost:8787/api/v1/bookmarklet/probe.js');
    expect(b).toContain('http://localhost:8787/api/v1/bookmarklet/injected-script.js');
    // data-bridge-origin uses UI origin (for postMessage)
    expect(b).toContain(JSON.stringify('http://localhost:5173'));
    // BRIDGE_ORIGIN in executor mode uses UI origin
    expect(b).toContain('var BRIDGE_ORIGIN=' + JSON.stringify('http://localhost:5173'));
  });
});
