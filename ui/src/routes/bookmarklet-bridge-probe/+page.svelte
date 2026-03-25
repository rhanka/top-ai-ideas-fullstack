<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  /**
   * Minimal probe page for the bookmarklet bootstrap.
   * The bootstrap creates a hidden iframe to this page and listens for a
   * 'bridge-probe-ack' postMessage to verify iframe communication works.
   *
   * This page does NOT require authentication — it's in PUBLIC_ROUTES.
   */
  onMount(() => {
    if (!browser) return;
    // Reply to the parent frame that loaded us
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'bridge-probe-ack' }, '*');
    }
  });
</script>

<svelte:head>
  <title>Top AI Bridge Probe</title>
</svelte:head>
