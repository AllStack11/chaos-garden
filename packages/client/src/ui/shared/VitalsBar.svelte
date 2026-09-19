<script lang="ts">
  interface Props {
    label: string;
    value: number;
    max?: number;
    color?: string;
  }

  let {
    label,
    value,
    max = 100,
    color = 'bg-garden-plant',
  }: Props = $props();

  let percent = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
</script>

<div class="flex flex-col gap-1 w-full text-xs">
  <div class="flex justify-between text-slate-300 font-mono">
    <span>{label}</span>
    <span>{Math.round(value)} / {max}</span>
  </div>
  <div class="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
    <div
      class="h-full rounded-full transition-all duration-200 {color}"
      style="width: {percent}%"
    ></div>
  </div>
</div>

