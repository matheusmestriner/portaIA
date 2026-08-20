"use client";

import { useState } from "react";

/** Capacidade do ambiente, não estado: avaliada uma vez, sem setState. */
export function useCameraSupported(): boolean {
  const [supported] = useState(
    () => typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia,
  );
  return supported;
}
