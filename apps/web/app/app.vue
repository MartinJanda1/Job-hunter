<script setup lang="ts">
import type { Job } from '@job-hunter/shared'

const { data: jobs, pending } = await useFetch<Job[]>('/api/jobs')
</script>

<template>
  <main class="wrap">
    <h1>Job-hunter</h1>
    <p v-if="pending">Načítám…</p>
    <p v-else-if="!jobs?.length">Zatím žádné vhodné nabídky.</p>
    <ul v-else class="list">
      <li v-for="job in jobs" :key="job.id" class="card">
        <div class="row">
          <a :href="job.url" target="_blank" rel="noopener">{{ job.title }}</a>
          <span v-if="job.score != null" class="score">{{ job.score }} %</span>
        </div>
        <small>{{ job.company }} · {{ job.location }} · {{ job.status }}</small>
        <p v-if="job.scoreReason">{{ job.scoreReason }}</p>
      </li>
    </ul>
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; margin: 0; background: #f6f7f9; color: #1d1f23; }
.wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px; }
.list { list-style: none; padding: 0; display: grid; gap: 12px; }
.card { background: #fff; border: 1px solid #e3e5e8; border-radius: 10px; padding: 14px 16px; }
.row { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
.score { color: #0a7a3d; }
</style>
