import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import OperativaApp from "@/app/OperativaApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZF Operativa Ostrov — operativní řízení směn skladu" },
      {
        name: "description",
        content:
          "Živé rozdělení operátorů na oddělení PICK (HOVC, HOVS, Putaway, VAS, OBWF, VNA, OBWI), přesuny, šablony směn a reporty pro vedení.",
      },
      { property: "og:title", content: "ZF Operativa Ostrov — řízení směn skladu" },
      {
        property: "og:description",
        content:
          "Sdílená online nástěnka směny: obsazení oddělení, přesuny operátorů, šablony a historie v reálném čase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-background" />}>
      <OperativaApp />
    </ClientOnly>
  );
}
