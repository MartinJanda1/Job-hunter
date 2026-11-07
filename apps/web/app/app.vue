<script setup lang="ts">
import { SOURCE_LABELS, type Job } from '@job-hunter/shared'

const { data: jobs, pending, error } = await useFetch<Job[]>('/api/jobs', { key: 'jobs' })

// Vypršelé přihlášení → na přihlašovací stránku
watch(error, (e) => {
  if (e?.statusCode === 401 && import.meta.client) window.location.href = '/login'
}, { immediate: true })

const meta = (job: Job) =>
  [job.company, job.location, job.salaryText, `zdroj: ${SOURCE_LABELS[job.source] ?? job.source}`]
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <div class="wrap">
    <header class="top">
      <h1>Job-hunter</h1>
      <form method="post" action="/api/auth/logout"><button class="logout">Odhlásit</button></form>
    </header>

    <div class="layout">
      <aside class="side">
        <KeywordsPanel />
        <SourcesPanel />
      </aside>

      <main>
        <h2 class="list-title">Vhodné nabídky <span v-if="jobs">({{ jobs.length }}{{ jobs.length === 100 ? '+' : '' }})</span></h2>
        <p v-if="pending">Načítám…</p>
        <p v-else-if="!jobs?.length">Zatím žádné vhodné nabídky.</p>
        <ul v-else class="list">
          <li v-for="job in jobs" :key="job.id" class="card">
            <div class="row">
              <a :href="job.url" target="_blank" rel="noopener">{{ job.title }}</a>
              <span v-if="job.score != null" class="score">{{ job.score }} %</span>
            </div>
            <small>{{ meta(job) }}</small>
            <p v-if="job.scoreReason">{{ job.scoreReason }}</p>
          </li>
        </ul>
      </main>
    </div>
  </div>
</template>

<style>
body { font-family: system-ui, sans-serif; margin: 0; background: #f6f7f9; color: #1d1f23; }
h1 { margin: 0; }
h2 { font-size: 17px; margin: 0 0 10px; }
.wrap { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
.logout { font: inherit; background: none; border: 1px solid #c9ccd1; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
.layout { display: grid; gap: 20px; }
@media (min-width: 900px) {
  .layout { grid-template-columns: 380px minmax(0, 1fr); align-items: start; }
  .side { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
}
.side { display: grid; gap: 16px; }
.panel { background: #fff; border: 1px solid #e3e5e8; border-radius: 10px; padding: 14px 16px; }
.list-title span { color: #6b717b; font-weight: 400; }
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.card { background: #fff; border: 1px solid #e3e5e8; border-radius: 10px; padding: 14px 16px; }
.row { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
.score { color: #0a7a3d; }
</style>
