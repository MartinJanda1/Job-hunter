<script setup lang="ts">
import type { KeywordsResponse, KeywordView } from '@job-hunter/shared'

const { data } = await useFetch<KeywordsResponse>('/api/keywords', { key: 'keywords' })

const busy = ref(false)
const error = ref('')
const newTerm = ref('')

// Zapnutá nahoře, pak podle počtu nabídek
const sorted = computed(() =>
  [...(data.value?.keywords ?? [])].sort((a, b) => Number(b.enabled) - Number(a.enabled) || b.count - a.count),
)
const maxCount = computed(() => Math.max(1, ...(data.value?.keywords ?? []).map((k) => k.count)))

/** Změna slov → server přepočítá nabídky; obnovit seznam nabídek i přehled zdrojů. */
async function mutate(request: () => Promise<KeywordsResponse>) {
  busy.value = true
  error.value = ''
  try {
    data.value = await request()
    await refreshNuxtData(['jobs', 'sources'])
  } catch (err: unknown) {
    error.value = (err as { statusMessage?: string; data?: { statusMessage?: string } }).data?.statusMessage ?? 'Akce se nepovedla'
  } finally {
    busy.value = false
  }
}

// URL jako obyčejný string – odvozování typů Nitro rout z template literálu je pro TS příliš hluboké.
const keywordUrl = (term: string): string => `/api/keywords/${encodeURIComponent(term)}`

const toggle = (k: KeywordView) =>
  mutate(() => $fetch<KeywordsResponse>(keywordUrl(k.term), { method: 'PATCH', body: { enabled: !k.enabled } }))

const remove = (k: KeywordView) => {
  if (confirm(`Smazat klíčové slovo „${k.term}“?`)) mutate(() => $fetch<KeywordsResponse>(keywordUrl(k.term), { method: 'DELETE' }))
}

async function add() {
  const term = newTerm.value.trim()
  if (!term) return
  await mutate(() => $fetch<KeywordsResponse>('/api/keywords', { method: 'POST', body: { term } }))
  if (!error.value) newTerm.value = ''
}
</script>

<template>
  <section class="panel">
    <h2>Klíčová slova</h2>
    <p class="summary">
      Lokalita: <strong>{{ data?.locations.join(', ') }}</strong> ·
      vhodných nabídek: <strong>{{ data?.matched ?? '–' }}</strong>
    </p>
    <p class="hint">Číslo = kolik nabídek v lokalitě slovo obsahuje (i u vypnutých – ukazuje, co by zapnutí přineslo).</p>

    <form class="add" @submit.prevent="add">
      <input v-model="newTerm" placeholder="Nové klíčové slovo…" maxlength="50" :disabled="busy">
      <button :disabled="busy || !newTerm.trim()">Přidat</button>
    </form>
    <p v-if="error" class="err">{{ error }}</p>

    <ul class="keywords" :class="{ busy }">
      <li v-for="k in sorted" :key="k.term" :class="{ off: !k.enabled }">
        <label>
          <input type="checkbox" :checked="k.enabled" :disabled="busy" @change="toggle(k)">
          <span class="term">{{ k.term }}</span>
        </label>
        <span class="bar" :style="{ width: `${(k.count / maxCount) * 100}%` }" />
        <span class="count">{{ k.count }}</span>
        <button class="del" title="Smazat" :disabled="busy" @click="remove(k)">×</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.summary { margin: 0 0 4px; font-size: 14px; }
.hint { margin: 0 0 12px; font-size: 12px; color: #6b717b; }
.add { display: flex; gap: 8px; margin-bottom: 10px; }
.add input { flex: 1; min-width: 0; font: inherit; padding: 6px 10px; border: 1px solid #c9ccd1; border-radius: 8px; }
.add button { font: inherit; padding: 6px 12px; border: 0; border-radius: 8px; background: #1d1f23; color: #fff; cursor: pointer; }
.add button:disabled { opacity: .5; cursor: default; }
.err { color: #b42318; font-size: 14px; margin: 0 0 8px; }
.keywords { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; font-size: 14px; }
.keywords.busy { opacity: .6; }
.keywords li { display: grid; grid-template-columns: minmax(0, 1fr) 70px 34px 24px; align-items: center; gap: 8px; padding: 3px 0; }
.keywords li.off .term { color: #8a9099; }
label { display: flex; align-items: center; gap: 8px; min-width: 0; cursor: pointer; }
.term { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar { height: 6px; border-radius: 3px; background: #9cc5ff; justify-self: start; min-width: 2px; }
li.off .bar { background: #d5d8dc; }
.count { text-align: right; font-variant-numeric: tabular-nums; color: #3b4048; }
.del { border: 0; background: none; color: #8a9099; font-size: 16px; cursor: pointer; padding: 0; }
.del:hover { color: #b42318; }
</style>
