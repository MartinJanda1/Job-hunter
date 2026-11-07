<script setup lang="ts">
import type { TextPart } from '@job-hunter/shared'

// Zvýraznění bez v-html – text z inzerátů se nikdy nevkládá jako HTML.
defineProps<{ parts: TextPart[] }>()
</script>

<template>
  <span><template v-for="(p, i) in parts" :key="i"><mark v-if="p.hit">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template></span>
</template>

<style scoped>
mark { background: #fff1a8; color: inherit; border-radius: 2px; padding: 0 1px; }
</style>
