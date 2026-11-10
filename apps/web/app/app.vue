<template>
  <div class="wrap">
    <header class="top">
      <div class="brand">
        <h1>Job-hunter</h1>
        <span class="version" :title="buildTitle">
          v{{ cfg.appVersion }}
          <template v-if="shortCommit">
            · <a :href="`https://github.com/MartinJanda1/Job-hunter/commit/${cfg.commit}`" target="_blank" rel="noopener">{{ shortCommit }}</a>
          </template>
        </span>
      </div>
      <form method="post" action="/api/auth/logout"><button class="logout">Odhlásit</button></form>
    </header>

    <div class="layout">
      <aside class="side">
        <KeywordsPanel />
        <SourcesPanel />
      </aside>
      <main>
        <JobsList />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
// Verze a commit buildu (nuxt.config.ts) – podle commitu je vidět, jestli se načetl poslední deploy
const cfg = useRuntimeConfig().public as { appVersion: string; commit: string; builtAt: string }
const shortCommit = cfg.commit.slice(0, 7)
const buildTitle = `Sestaveno ${cfg.builtAt}`
</script>

<style>
body { font-family: system-ui, sans-serif; margin: 0; background: #f6f7f9; color: #1d1f23; }
h1 { margin: 0; }
h2 { font-size: 17px; margin: 0 0 10px; }
a { color: #1a56db; }
.wrap { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
.brand { display: flex; align-items: baseline; gap: 10px; }
.version { font-size: 13px; color: #6b7079; }
.version a { color: inherit; }
.logout { font: inherit; background: none; border: 1px solid #c9ccd1; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
.layout { display: grid; gap: 20px; }
@media (min-width: 900px) {
  .layout { grid-template-columns: 380px minmax(0, 1fr); align-items: start; }
  .side { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
}
.side { display: grid; gap: 16px; }
.panel { background: #fff; border: 1px solid #e3e5e8; border-radius: 10px; padding: 14px 16px; }
</style>
