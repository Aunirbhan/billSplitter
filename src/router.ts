import { useEffect, useState } from "react";

export type Route =
  | { name: "landing" }
  | { name: "scan" }
  | { name: "review" }
  | { name: "settings"; returnTo?: string }
  | { name: "room"; blob: string }
  | { name: "bill"; id: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  if (h.startsWith("r/")) return { name: "room", blob: h.slice(2) };
  if (h.startsWith("bill/")) return { name: "bill", id: h.slice(5) };
  if (h === "scan") return { name: "scan" };
  if (h === "review") return { name: "review" };
  if (h.startsWith("settings")) return { name: "settings" };
  return { name: "landing" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = path;
}
