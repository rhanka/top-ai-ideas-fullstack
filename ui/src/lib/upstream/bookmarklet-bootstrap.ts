/**
 * Generates the bookmarklet bootstrap JavaScript string.
 *
 * The bootstrap performs adaptive CSP probing:
 * 1. Attempts TrustedTypes policy creation (tries 'topai', then common names)
 * 2. Probes inline script execution capability
 * 3. Probes iframe communication via postMessage handshake
 * 4. Selects the best communication strategy based on probe results
 *
 * Strategies:
 * - iframe + inline: inject inline script + create bridge iframe (best case)
 * - iframe + external: create bridge iframe + load script via <script src> (inline blocked)
 * - iframe blocked + inline OK: inject inline script, use JSONP/img fallback (Lot 6)
 * - all blocked: show badge "Installez l'extension Chrome pour ce site"
 *
 * @param bridgeUrl - Full URL to the bridge iframe page (e.g. "https://app.example.com/bookmarklet-bridge?nonce=abc")
 * @param scriptContent - The full injected script IIFE string
 * @param apiOrigin - The webapp/API origin (e.g. "https://app.example.com")
 */
export function generateBookmarkletBootstrap(
  bridgeUrl: string,
  scriptContent: string,
  apiOrigin: string,
): string {
  // The TT policy names to try, in order, if 'topai' fails
  const TT_FALLBACK_NAMES = [
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

  return (
    'javascript:void(' +
    '(function(){' +
    // Re-entrant guard
    'if(window.__TOPAI_ACTIVE){return;}' +

    // --- TrustedTypes bypass ---
    'var tp=null;' +
    'if(typeof trustedTypes!=="undefined"&&trustedTypes.createPolicy){' +
    // Try 'topai' first
    'try{tp=trustedTypes.createPolicy("topai",{createHTML:function(s){return s;},createScriptURL:function(s){return s;},createScript:function(s){return s;}});}catch(e){' +
    // On failure, try common names in order
    'var names=' + JSON.stringify(TT_FALLBACK_NAMES) + ';' +
    'for(var i=0;i<names.length;i++){' +
    'try{tp=trustedTypes.createPolicy(names[i],{createHTML:function(s){return s;},createScriptURL:function(s){return s;},createScript:function(s){return s;}});break;}catch(e2){}' +
    '}' +
    '}' +
    '}' +

    // --- Inline script probe ---
    'var inlineOk=false;' +
    'try{' +
    'var ps=document.createElement("script");' +
    'var pc=tp?tp.createScript("window.__TOPAI_INLINE_PROBE=1"):"window.__TOPAI_INLINE_PROBE=1";' +
    'ps.textContent=pc;' +
    'document.head.appendChild(ps);' +
    'ps.remove();' +
    'inlineOk=!!window.__TOPAI_INLINE_PROBE;' +
    'delete window.__TOPAI_INLINE_PROBE;' +
    '}catch(e){}' +

    // --- Iframe probe via postMessage handshake ---
    'var iframeOk=false;' +
    'var probeUrl=' + JSON.stringify(apiOrigin + '/bookmarklet-bridge-probe') + ';' +
    'var probeFrame=document.createElement("iframe");' +
    'probeFrame.style.cssText="display:none;width:0;height:0;border:none;position:absolute;";' +
    'var pSrc=tp?tp.createScriptURL(probeUrl):probeUrl;' +
    'probeFrame.src=pSrc;' +

    // Set up message listener for probe ack
    'var probeResolve;' +
    'var probePromise=new Promise(function(r){probeResolve=r;});' +
    'function onProbeMsg(ev){' +
    'if(ev.data&&ev.data.type==="bridge-probe-ack"){' +
    'iframeOk=true;' +
    'probeResolve();' +
    '}' +
    '}' +
    'window.addEventListener("message",onProbeMsg);' +
    'document.body.appendChild(probeFrame);' +

    // Wait up to 3s for probe ack, then proceed
    'var timeout=new Promise(function(r){setTimeout(r,3000);});' +
    'Promise.race([probePromise,timeout]).then(function(){' +
    'window.removeEventListener("message",onProbeMsg);' +
    'probeFrame.remove();' +

    // --- Strategy selection ---
    'if(iframeOk&&inlineOk){' +
    // Best case: iframe bridge + inline script
    'var f=document.createElement("iframe");' +
    'f.id="__topai_bridge";' +
    'f.style.cssText="display:none;width:0;height:0;border:none;position:absolute;";' +
    'var bUrl=' + JSON.stringify(bridgeUrl) + ';' +
    'f.src=tp?tp.createScriptURL(bUrl):bUrl;' +
    'document.body.appendChild(f);' +
    'var s=document.createElement("script");' +
    'var code=' + JSON.stringify(scriptContent) + ';' +
    's.textContent=tp?tp.createScript(code):code;' +
    'document.head.appendChild(s);' +

    '}else if(iframeOk&&!inlineOk){' +
    // iframe OK, inline blocked: load script via <script src>
    'var f=document.createElement("iframe");' +
    'f.id="__topai_bridge";' +
    'f.style.cssText="display:none;width:0;height:0;border:none;position:absolute;";' +
    'var bUrl=' + JSON.stringify(bridgeUrl) + ';' +
    'f.src=tp?tp.createScriptURL(bUrl):bUrl;' +
    'document.body.appendChild(f);' +
    'var s=document.createElement("script");' +
    'var extUrl=' + JSON.stringify(apiOrigin + '/api/v1/bookmarklet/injected-script.js') + ';' +
    's.src=tp?tp.createScriptURL(extUrl):extUrl;' +
    's.setAttribute("data-bridge-origin",' + JSON.stringify(apiOrigin) + ');' +
    'document.head.appendChild(s);' +

    '}else if(!iframeOk&&inlineOk){' +
    // iframe blocked, inline OK: JSONP/img fallback (Lot 6)
    // For now, inject inline script with JSONP mode flag
    'window.__TOPAI_JSONP_MODE=true;' +
    'window.__TOPAI_API_ORIGIN=' + JSON.stringify(apiOrigin) + ';' +
    'var s=document.createElement("script");' +
    'var code=' + JSON.stringify(scriptContent) + ';' +
    's.textContent=tp?tp.createScript(code):code;' +
    'document.head.appendChild(s);' +

    '}else{' +
    // All blocked: show extension install badge
    'var b=document.createElement("div");' +
    'b.id="__topai_badge";' +
    'b.style.cssText="position:fixed;bottom:16px;right:16px;z-index:2147483647;' +
    'padding:6px 14px;border-radius:20px;font-family:system-ui,sans-serif;font-size:13px;' +
    'font-weight:600;color:#fff;background:#ef4444;box-shadow:0 2px 8px rgba(0,0,0,.25);' +
    'cursor:default;user-select:none;opacity:0.9;";' +
    'b.textContent="Installez l\\u0027extension Chrome pour ce site";' +
    'document.body.appendChild(b);' +
    '}' +

    '});' + // end Promise.race.then
    '})()' +
    ')'
  );
}
