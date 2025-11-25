// src/components/UnicornBackground.jsx
import { useEffect } from "react";

const SCRIPT_URL = "https://framer.com/m/UnicornStudioEmbed-wWy9.js";
const PROJECT_ID = "rf7xVANmQuhoMNBSEKoH";

export default function UnicornBackground() {
  useEffect(() => {
    // Only add the Unicorn script once; load as a module to support ES exports
    if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) return;

    // Provide an import map so the Unicorn module can resolve React deps in the browser
    const existingImportMap = document.querySelector('script[data-unicorn-importmap="true"]');
    if (!existingImportMap) {
      const importMap = document.createElement("script");
      importMap.type = "importmap";
      importMap.setAttribute("data-unicorn-importmap", "true");
      importMap.textContent = JSON.stringify({
        imports: {
          react: "https://esm.sh/react@18",
          "react-dom": "https://esm.sh/react-dom@18",
          "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
          framer: "https://esm.sh/framer@2",
          "framer-motion": "https://esm.sh/framer-motion@11",
        },
      });
      document.head.appendChild(importMap);
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.type = "module";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div
      data-us-project={PROJECT_ID}
      style={{
        position: "absolute",
        inset: 0,          // full container (top/right/bottom/left = 0)
        width: "100%",
        height: "100%",
        zIndex: 0,         // behind your actual content
        pointerEvents: "none", // so your UI is clickable
      }}
    />
  );
}
