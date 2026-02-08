import type { Bindings } from "./db.js";

export type Env = {
  Bindings: Bindings;
  Variables: {
    userId: string;
  };
};
