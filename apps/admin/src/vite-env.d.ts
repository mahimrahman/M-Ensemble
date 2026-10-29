/// <reference types="vite/client" />

/**
 * The console's build-time variables. `vite/client` types `import.meta.env` as
 * `any`-valued for unknown keys; naming them here means a typo in a page is a
 * compile error rather than an `undefined` that only shows up in production.
 */
interface ImportMetaEnv {
  /** Sentry project DSN. Absent in development and when error reporting is off. */
  readonly VITE_SENTRY_DSN?: string;
}
