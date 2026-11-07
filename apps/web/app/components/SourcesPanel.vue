<script setup lang="ts">
import type { SourceView } from '@job-hunter/shared'

const { data: sources } = await useFetch<SourceView[]>('/api/sources', { key: 'sources' })
</script>

<template>
  <section class="panel">
    <h2>Zdroje</h2>
    <table v-if="sources?.length" class="sources">
      <thead>
        <tr><th>Zdroj</th><th title="Vhodné / celkem v databázi">Nabídky</th><th>Naposledy</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in sources" :key="s.key">
          <td>
            <a :href="s.url" target="_blank" rel="noopener">{{ s.label }}</a>
            <small>{{ s.kind }} · {{ s.schedule }}</small>
          </td>
          <td class="num"><strong>{{ s.matched }}</strong> / {{ s.total }}</td>
          <td class="when" :title="s.lastCheckedAt ? `Staženo: ${s.lastCheckedAt}` : undefined">
            {{ timeAgo(s.lastCheckedAt ?? s.lastFoundAt) }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.sources { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; font-weight: 500; color: #5b616b; padding: 0 0 6px; }
td { padding: 6px 0; border-top: 1px solid #eef0f2; vertical-align: top; }
td small { display: block; color: #6b717b; font-size: 12px; }
.num { text-align: right; white-space: nowrap; padding-right: 10px; }
th:nth-child(2) { text-align: right; padding-right: 10px; }
.when { white-space: nowrap; color: #5b616b; }
</style>
