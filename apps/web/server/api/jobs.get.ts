import type { Job } from '@job-hunter/shared'

// GET /api/jobs – zatím ukázková data; později čtení z databáze, kam zapisuje worker.
export default defineEventHandler((): Job[] => {
  return [
    {
      id: 'demo:1',
      source: 'demo',
      externalId: '1',
      title: 'Frontend developer (Vue 3)',
      company: 'Ukázková firma s.r.o.',
      location: 'Praha / remote',
      url: 'https://example.com',
      foundAt: new Date().toISOString(),
      score: 82,
      scoreReason: 'Vue 3 a Node.js odpovídají CV',
      status: 'matched',
    },
  ]
})
