<script lang="ts">
  import GlassPanel from '../shared/GlassPanel.svelte';

  interface Props {
    volume: number;
    isMuted: boolean;
    onVolumeChange: (val: number) => void;
    onToggleMute: () => void;
  }

  let { volume, isMuted, onVolumeChange, onToggleMute }: Props = $props();
</script>

<GlassPanel class="px-3 py-1.5 flex items-center gap-2 pointer-events-auto text-xs">
  <button
    class="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 transition border border-slate-700 text-sm"
    onclick={onToggleMute}
    title={isMuted ? 'Unmute Procedural Audio' : 'Mute Audio'}
  >
    {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
  </button>

  <input
    type="range"
    min="0"
    max="1"
    step="0.05"
    value={volume}
    oninput={(e) => onVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
    class="w-20 accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
    title="Master Volume"
  />
</GlassPanel>

