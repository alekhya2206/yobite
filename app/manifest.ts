import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YoBite — Order this.",
    short_name: "YoBite",
    description:
      "Scan a menu, say what you're in the mood for, get one confident order. A ranker, not a calorie counter.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF1E6",
    theme_color: "#FFF1E6",
    orientation: "portrait",
    categories: ["food", "health", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
