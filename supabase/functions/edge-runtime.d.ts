/** Deno / Supabase Edge — URL import maps to the same types as the npm package. */
declare module "https://esm.sh/@supabase/supabase-js@2.49.8" {
  export * from "@supabase/supabase-js";
}

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};
