import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getMetaPixelId } from "@/lib/meta.functions";
import { META_PIXEL_ID, loadMetaPixel, metaTrack } from "@/lib/meta-pixel";

/** Carrega o pixel com o ID salvo no /admin e envia PageView a cada troca de página. */
export function useMetaPixel() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    getMetaPixelId()
      .then((r) => {
        loadMetaPixel(r.pixelId || META_PIXEL_ID);
      })
      .catch(() => loadMetaPixel(META_PIXEL_ID));
  }, []);

  useEffect(() => {
    if (path.startsWith("/admin")) return;
    metaTrack("PageView", undefined, path);
  }, [path]);
}
