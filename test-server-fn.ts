import { createServerFn } from "@tanstack/react-start";

export const myFn = createServerFn({ method: "GET" }).handler(async () => {
  return "hello";
});
