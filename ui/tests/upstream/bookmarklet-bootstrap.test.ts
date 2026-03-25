import { describe, expect, it } from 'vitest';
import { generateBookmarkletBootstrap } from '../../src/lib/upstream/bookmarklet-bootstrap';

describe('generateBookmarkletBootstrap', () => {
  const BRIDGE_URL = 'https://app.topai.com/bookmarklet-bridge?nonce=abc123';
  const SCRIPT_CONTENT = '(function(){console.log("injected")})();';
  const API_ORIGIN = 'https://app.topai.com';

  const bootstrap = generateBookmarkletBootstrap(BRIDGE_URL, SCRIPT_CONTENT, API_ORIGIN);

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

  it('strategy: iframe + external -> loads script via src', () => {
    expect(bootstrap).toContain('if(iframeOk&&!inlineOk)');
    expect(bootstrap).toContain('/api/v1/bookmarklet/injected-script.js');
    expect(bootstrap).toContain('data-bridge-origin');
  });

  it('strategy: JSONP fallback when iframe blocked but inline works', () => {
    expect(bootstrap).toContain('if(!iframeOk&&inlineOk)');
    expect(bootstrap).toContain('__TOPAI_JSONP_MODE');
    expect(bootstrap).toContain('__TOPAI_API_ORIGIN');
  });

  it('strategy: all blocked -> shows extension install badge', () => {
    expect(bootstrap).toContain('Installez l');
    expect(bootstrap).toContain('extension Chrome');
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

  it('embeds the API origin', () => {
    expect(bootstrap).toContain(API_ORIGIN);
  });

  // --- Different inputs produce different outputs ---

  it('generates different bootstrap for different bridge URLs', () => {
    const other = generateBookmarkletBootstrap(
      'https://other.com/bridge',
      SCRIPT_CONTENT,
      'https://other.com',
    );
    expect(other).not.toBe(bootstrap);
    expect(other).toContain('https://other.com/bridge');
  });
});
