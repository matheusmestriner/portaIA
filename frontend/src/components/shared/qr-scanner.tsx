"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, RefreshCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCameraSupported } from "@/hooks/use-camera-supported";

/**
 * Lê o QR Code que o app do morador exibe. Decodifica localmente (jsqr sobre
 * frames do <video>) — a imagem nunca sai do dispositivo; só o conteúdo do QR
 * é enviado ao backend para validação.
 */
export function QrScanner({ onDetected, onCancel }: { onDetected: (value: string) => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectedRef = useRef(false);

  const cameraSupported = useCameraSupported();

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  /**
   * Assina a câmera e roda a decodificação local. Nenhum setState acontece
   * antes do primeiro await, para que chamar isto de um efeito não seja um
   * setState síncrono no corpo do efeito.
   */
  const start = useCallback(async () => {
    detectedRef.current = false;
    await Promise.resolve();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      setError("");

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });

      const tick = () => {
        const video = videoRef.current;
        if (!video || !context || detectedRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (found?.data) {
            detectedRef.current = true;
            stop();
            setScanning(false);
            onDetected(found.data);
            return;
          }
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Não foi possível abrir a câmera para leitura do QR Code.");
      setScanning(false);
    }
  }, [onDetected, stop]);

  useEffect(() => {
    if (!cameraSupported) return;
    // Mesmo caso do PhotoCapture: assinatura de um sistema externo (câmera),
    // com todo o setState acontecendo depois do primeiro await. A regra é
    // estática e não consegue enxergar através do `async`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
    return stop;
  }, [cameraSupported, start, stop]);

  const message = cameraSupported
    ? error
    : "A leitura de QR exige localhost ou HTTPS e uma câmera disponível.";

  return (
    <div className="space-y-3">
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="relative aspect-video overflow-hidden rounded-md border bg-black">
        <video ref={videoRef} playsInline muted className="size-full object-contain" />
        {scanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-48 rounded-lg border-2 border-white/70" />
          </div>
        )}
        {!scanning && !message && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <RefreshCw className="size-6 animate-spin" />
          </div>
        )}
        {message && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <CameraOff className="size-7" />
          </div>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ScanLine className="size-4" />
        Aponte para o QR Code que o morador está exibindo.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => { stop(); onCancel(); }}>
          Cancelar
        </Button>
        {error && (
          <Button type="button" size="sm" onClick={() => void start()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
