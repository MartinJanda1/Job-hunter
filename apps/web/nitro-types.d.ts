// Nuxt 3.21 typuje `nitro` v nuxt.config jen zúženým záložním typem, dokud builder nerozšíří NitroTypes.
// Tady to doplníme ručně, aby šly typově kontrolovat volby presetů (např. `nitro.vercel`).
import type { NitroConfig } from 'nitropack'

declare module '@nuxt/schema' {
  interface NitroTypes {
    config: NitroConfig
  }
}

export {}
