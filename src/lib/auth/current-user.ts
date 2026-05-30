import { cache } from "react";
import { headers } from "next/headers";

export const currentUserId = cache(async (): Promise<string | null> => {
  const h = await headers();
  return h.get("x-user-id");
});
