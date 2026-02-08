export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  /** Origens permitidas para CORS (separadas por vírgula). Ex.: https://seu-app.pages.dev,http://localhost:3000 */
  CORS_ORIGINS?: string;
};
