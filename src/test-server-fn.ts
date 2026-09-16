import { createServerFn } from "@tanstack/react-start";

export const extractOperatorsFn = createServerFn({ method: "POST" })
  .validator((d: { imageBase64?: string }) => d)
  .handler(async ({ data }) => {
    return { success: true };
  });
