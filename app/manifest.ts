import type { MetadataRoute } from "next";

/** PWA install manifest (Chrome, Edge, Android; Safari uses appleWebApp metadata in layout). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkAna",
    short_name: "SkAna",
    description: "Simple CRM for small teams and co-founders",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#134e5e",
    theme_color: "#0b353d",
    icons: [
      {
        src: "/skana-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
