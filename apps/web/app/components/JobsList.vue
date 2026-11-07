<script setup lang="ts">
import { SOURCE_LABELS, type JobListItem, type JobListView, type JobMark, type JobsResponse } from '@job-hunter/shared'

const view = ref<JobListView>('inbox')
const { data, pending, error, refresh } = await useFetch<JobsResponse>('/api/jobs', { key: 'jobs', query: { view } })

// Vypršelé přihlášení → na přihlašovací stránku
watch(error, (e) => {
  if (e?.statusCode === 401 && import.meta.client) window.location.href = '/login'
}, { immediate: true })

const TABS: { view: JobListView; label: string }[] = [
  { view: 'inbox', label: 'K prohlédnutí' },
  { view: 'starred', label: '⭐ Zajímavé' },
  { view: 'applied', label: '✓ Odpovězeno' },
  { view: 'hidden', label: 'Skryté' },
]
const ACTIONS: { mark: JobMark; icon: string; label: string }[] = [
  { mark: 'starred', icon: '⭐', label: 'Zajímavá' },
  { mark: 'applied', icon: '✓', label: 'Odpovězeno' },
  { mark: 'hidden', icon: '✕', label: 'Skrýt' },
]

const meta = (job: JobListItem) =>
  [job.company, job.location, job.salaryText, `zdroj: ${SOURCE_LABELS[job.source] ?? job.source}`].filter(Boolean).join(' · ')

/** Poslední akce pro „Zpět“ */
const last = ref<{ job: JobListItem; prev: JobMark | null; label: string } | null>(null)
const failed = ref('')

/** Označí / odznačí nabídku. Seznam a počty se upraví hned, server se volá na pozadí. */
async function setMark(job: JobListItem, clicked: JobMark) {
  const prev = job.mark ?? null
  const next = prev === clicked ? null : clicked
  applyLocally(job, prev, next)
  last.value = { job, prev, label: next ? ACTIONS.find((a) => a.mark === next)!.label : 'Označení zrušeno' }
  await save(job.id, next)
}

async function undo() {
  const action = last.value
  if (!action) return
  last.value = null
  await save(action.job.id, action.prev)
  await refresh()
}

async function save(id: string, mark: JobMark | null) {
  failed.value = ''
  try {
    const url: string = `/api/jobs/${encodeURIComponent(id)}` // string kvůli hloubce typů Nitro rout
    await $fetch<unknown>(url, { method: 'PATCH', body: { mark } })
  } catch {
    failed.value = 'Označení se nepodařilo uložit'
    await refresh()
  }
}

function applyLocally(job: JobListItem, prev: JobMark | null, next: JobMark | null) {
  const d = data.value
  if (!d) return
  const bucket = (m: JobMark | null): JobListView | null => m ?? (job.status === 'matched' ? 'inbox' : null)
  const from = bucket(prev)
  const to = bucket(next)
  if (from) d.counts[from]--
  if (to) d.counts[to]++
  job.mark = next ?? undefined
  if (to !== d.view) d.jobs = d.jobs.filter((j) => j.id !== job.id)
}

watch(view, () => (last.value = null))
</script>

<template>
  <section>
    <nav class="tabs">
      <button v-for="t in TABS" :key="t.view" :class="{ active: view === t.view }" @click="view = t.view">
        {{ t.label }} <span class="n">{{ data?.counts[t.view] ?? '' }}</span>
      </button>
    </nav>

    <p v-if="last" class="undo">
      {{ last.label }}: <em>{{ last.job.title }}</em> · <button @click="undo">Zpět</button>
    </p>
    <p v-if="failed" class="err">{{ failed }}</p>

    <p v-if="pending && !data">Načítám…</p>
    <p v-else-if="!data?.jobs.length" class="empty">
      {{ view === 'inbox' ? 'Nic nového k prohlédnutí.' : 'Tady zatím nic není.' }}
    </p>
    <ul v-else class="list" :class="{ loading: pending }">
      <li v-for="job in data.jobs" :key="job.id" class="card" :class="{ starred: job.mark === 'starred' }">
        <div class="row">
          <a :href="job.url" target="_blank" rel="noopener" class="title"><HighlightText :parts="job.titleParts" /></a>
          <div class="actions">
            <button
              v-for="a in ACTIONS" :key="a.mark"
              :class="['act', a.mark, { on: job.mark === a.mark }]"
              :title="job.mark === a.mark ? `Zrušit: ${a.label}` : a.label"
              @click="setMark(job, a.mark)"
            >{{ a.icon }}</button>
          </div>
        </div>
        <small class="meta">{{ meta(job) }}</small>
        <div v-if="job.keywords.length" class="chips">
          <span v-for="k in job.keywords" :key="k" class="chip">{{ k }}</span>
        </div>
        <p v-if="job.excerpt" class="excerpt"><HighlightText :parts="job.excerpt" /></p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.tabs button { font: inherit; font-size: 14px; border: 1px solid #c9ccd1; background: #fff; border-radius: 999px; padding: 5px 12px; cursor: pointer; }
.tabs button.active { background: #1d1f23; border-color: #1d1f23; color: #fff; }
.tabs .n { opacity: .7; margin-left: 2px; }
.undo { font-size: 14px; background: #eef4ff; border: 1px solid #cfe0ff; border-radius: 8px; padding: 6px 10px; margin: 0 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.undo button { font: inherit; border: 0; background: none; color: #1a56db; cursor: pointer; padding: 0; text-decoration: underline; }
.err { color: #b42318; font-size: 14px; }
.empty { color: #5b616b; }
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.list.loading { opacity: .6; }
.card { background: #fff; border: 1px solid #e3e5e8; border-radius: 10px; padding: 14px 16px; }
.card.starred { border-color: #f5c542; }
.row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.title { font-weight: 600; }
.actions { display: flex; gap: 4px; flex-shrink: 0; }
.act { width: 32px; height: 32px; border: 1px solid #d5d8dc; background: #fff; border-radius: 8px; cursor: pointer; font-size: 15px; line-height: 1; filter: grayscale(1); opacity: .55; }
.act:hover { opacity: 1; filter: none; }
.act.on { opacity: 1; filter: none; }
.act.starred.on { background: #fff6d6; border-color: #f5c542; }
.act.applied.on { background: #dff5e8; border-color: #34a853; color: #0a7a3d; }
.act.hidden.on { background: #fde7e7; border-color: #e5484d; color: #b42318; }
.meta { display: block; color: #5b616b; margin-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.chip { font-size: 12px; background: #fff1a8; border-radius: 999px; padding: 1px 8px; }
.excerpt { font-size: 14px; color: #3b4048; margin: 8px 0 0; line-height: 1.45; }
</style>
