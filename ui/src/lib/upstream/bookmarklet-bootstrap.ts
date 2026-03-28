/**
 * Generates the bookmarklet bootstrap JavaScript string.
 *
 * The bootstrap performs adaptive CSP probing:
 * 1. Attempts TrustedTypes policy creation (tries 'topai', then common names)
 * 2. Probes inline script execution capability
 * 3. Probes external script loading capability
 * 4. Probes iframe communication via postMessage handshake
 * 5. Selects the best communication strategy based on probe results
 *
 * Strategies (fallback chain):
 * - iframe + inline: inject inline script + create bridge iframe (best case)
 * - iframe + external: create bridge iframe + load script via <script src> (inline blocked)
 * - executor + iframe: bookmarklet code acts as DOM executor + bridge iframe (both scripts blocked, e.g. LinkedIn)
 * - jsonp: inject inline script with JSONP/img fallback (iframe blocked, inline OK)
 * - blocked: show badge "Installez l'extension Chrome pour ce site"
 *
 * @param bridgeUrl - Full URL to the bridge iframe page (e.g. "https://app.example.com/bookmarklet-bridge?nonce=abc")
 * @param scriptContent - The full injected script IIFE string
 * @param uiOrigin - The UI/webapp origin for SvelteKit routes (e.g. "http://localhost:5173")
 * @param apiOrigin - The API origin for backend endpoints (e.g. "http://localhost:8787")
 */
export function generateBookmarkletBootstrap(
  bridgeUrl: string,
  scriptContent: string,
  uiOrigin: string,
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

    // --- External script probe ---
    'var externalOk=false;' +
    'var extProbeUrl=' + JSON.stringify(apiOrigin + '/api/v1/bookmarklet/probe.js') + ';' +
    'var extProbeResolve;' +
    'var extProbePromise=new Promise(function(r){extProbeResolve=r;});' +
    'var eps=document.createElement("script");' +
    'eps.src=tp?tp.createScriptURL(extProbeUrl):extProbeUrl;' +
    'eps.onload=function(){externalOk=true;eps.remove();extProbeResolve();};' +
    'eps.onerror=function(){eps.remove();extProbeResolve();};' +
    'document.head.appendChild(eps);' +

    // --- Iframe probe via postMessage handshake ---
    'var iframeOk=false;' +
    'var probeUrl=' + JSON.stringify(uiOrigin + '/bookmarklet-bridge-probe') + ';' +
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

    // Wait up to 3s for all probes, then proceed
    'var timeout=new Promise(function(r){setTimeout(r,3000);});' +
    'Promise.all([extProbePromise,Promise.race([probePromise,timeout])]).then(function(){' +
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

    '}else if(iframeOk&&externalOk){' +
    // iframe OK, external OK: load script via <script src>
    'var f=document.createElement("iframe");' +
    'f.id="__topai_bridge";' +
    'f.style.cssText="display:none;width:0;height:0;border:none;position:absolute;";' +
    'var bUrl=' + JSON.stringify(bridgeUrl) + ';' +
    'f.src=tp?tp.createScriptURL(bUrl):bUrl;' +
    'document.body.appendChild(f);' +
    'var s=document.createElement("script");' +
    'var extUrl=' + JSON.stringify(apiOrigin + '/api/v1/bookmarklet/injected-script.js') + ';' +
    's.src=tp?tp.createScriptURL(extUrl):extUrl;' +
    's.setAttribute("data-bridge-origin",' + JSON.stringify(uiOrigin) + ');' +
    'document.head.appendChild(s);' +

    '}else if(iframeOk){' +
    // iframe OK, both inline and external blocked: executor+iframe mode
    // The bookmarklet code itself acts as the DOM executor
    'window.__TOPAI_ACTIVE=true;' +
    'var BRIDGE_ORIGIN=' + JSON.stringify(uiOrigin) + ';' +

    // Create bridge iframe
    'var f=document.createElement("iframe");' +
    'f.id="__topai_bridge";' +
    'f.style.cssText="display:none;width:0;height:0;border:none;position:absolute;";' +
    'var bUrl=' + JSON.stringify(bridgeUrl) + ';' +
    'f.src=tp?tp.createScriptURL(bUrl):bUrl;' +
    'document.body.appendChild(f);' +

    // Badge
    'var badge=document.createElement("div");' +
    'badge.id="__topai_badge";' +
    'badge.style.cssText="position:fixed;bottom:16px;right:16px;z-index:2147483647;' +
    'padding:6px 14px;border-radius:20px;font-family:system-ui,sans-serif;font-size:13px;' +
    'font-weight:600;color:#fff;background:#6366f1;box-shadow:0 2px 8px rgba(0,0,0,.25);' +
    'cursor:default;user-select:none;transition:background .3s,opacity .3s;opacity:0.9;";' +
    'badge.textContent="Connecting...";' +
    'document.body.appendChild(badge);' +

    // Truncate utility
    'function truncate(str,maxLen){' +
    'if(!maxLen)maxLen=60000;' +
    'if(str.length<=maxLen)return str;' +
    'return str.substring(0,maxLen)+"... [truncated]";' +
    '}' +

    // Send result to bridge iframe
    'function sendResult(callId,result){' +
    'var bi=document.getElementById("__topai_bridge");' +
    'if(!bi||!bi.contentWindow)return;' +
    'bi.contentWindow.postMessage({type:"tool_result",callId:callId,result:result},BRIDGE_ORIGIN);' +
    '}' +

    // tab_read handler
    'function handleTabRead(callId,args){' +
    'var selector=(args&&args.selector)||"body";' +
    'try{' +
    'var el=document.querySelector(selector);' +
    'if(!el){sendResult(callId,{error:"Element not found: "+selector});return;}' +
    'var html=truncate(el.outerHTML);' +
    'var text=truncate(el.textContent||"");' +
    'sendResult(callId,{outerHTML:html,textContent:text});' +
    '}catch(e){sendResult(callId,{error:"tab_read error: "+String(e)});}' +
    '}' +

    // tab_action handler
    'function handleTabAction(callId,args){' +
    'var action=(args&&args.action)||"";' +
    'var selector=(args&&args.selector)||"";' +
    'try{' +
    'if(action==="click"){' +
    'var el=document.querySelector(selector);' +
    'if(!el){sendResult(callId,{error:"Element not found: "+selector});return;}' +
    'el.click();' +
    'sendResult(callId,{ok:true,action:"click",selector:selector});' +
    '}else if(action==="input"){' +
    'var el2=document.querySelector(selector);' +
    'if(!el2){sendResult(callId,{error:"Element not found: "+selector});return;}' +
    'var nv=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value");' +
    'if(nv&&nv.set){nv.set.call(el2,args.value||"");}else{el2.value=args.value||"";}' +
    'el2.dispatchEvent(new Event("input",{bubbles:true}));' +
    'el2.dispatchEvent(new Event("change",{bubbles:true}));' +
    'sendResult(callId,{ok:true,action:"input",selector:selector});' +
    '}else if(action==="scroll"){' +
    'var x=Number(args.x)||0;var y=Number(args.y)||0;' +
    'if(selector){var el3=document.querySelector(selector);if(el3){el3.scrollBy(x,y);}}' +
    'else{window.scrollBy(x,y);}' +
    'sendResult(callId,{ok:true,action:"scroll"});' +
    '}else{sendResult(callId,{error:"Unknown action: "+action});}' +
    '}catch(e){sendResult(callId,{error:"tab_action error: "+String(e)});}' +
    '}' +

    // PostMessage listener for commands from bridge
    'window.addEventListener("message",function(ev){' +
    'if(ev.origin!==BRIDGE_ORIGIN)return;' +
    'var d=ev.data;' +
    'if(!d||typeof d!=="object")return;' +
    'if(d.type==="connected"){badge.textContent="Top AI \\u2713";badge.style.background="#22c55e";return;}' +
    'if(d.type==="command"){' +
    'var cid=d.callId;var tn=d.toolName;var a=d.args||{};' +
    'if(tn==="tab_read"){handleTabRead(cid,a);}' +
    'else if(tn==="tab_action"){handleTabAction(cid,a);}' +
    '}' +
    '});' +

    // Register with bridge on load
    'f.addEventListener("load",function(){' +
    'f.contentWindow.postMessage({type:"register",url:location.href,title:document.title},BRIDGE_ORIGIN);' +
    '});' +

    // beforeunload: badge disconnected
    'window.addEventListener("beforeunload",function(){' +
    'badge.textContent="Disconnected";badge.style.background="#ef4444";badge.style.opacity="0.7";' +
    '});' +

    '}else if(inlineOk){' +
    // iframe blocked, inline OK: JSONP/img fallback (Lot 6)
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

    '});' + // end Promise.all.then
    '})()' +
    ')'
  );
}
