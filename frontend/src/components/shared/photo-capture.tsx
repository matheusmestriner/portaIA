"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, MonitorUp, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCameraSupported } from "@/hooks/use-camera-supported";

export interface PhotoSelection {
  file: File;
  source: "camera" | "computer";
  previewUrl: string;
}

type CameraStatus = "idle" | "requesting" | "streaming" | "captured" | "error";
type FacingMode = "user" | "environment";

function cameraErrorMessage(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "A câmera só funciona em localhost ou em uma conexão HTTPS.";
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Permissão de câmera negada. Libere o acesso no cadeado da barra de endereço e tente de novo.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "Nenhuma câmera encontrada neste dispositivo.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "A câmera está em uso por outro aplicativo. Feche-o e tente de novo.";
    }
  }
  return "Não foi possível iniciar a câmera. Verifique as permissões do navegador.";
}

/**
 * Captura a foto do ato (recebimento ou retirada) direto da câmera, com
 * alternativa de importar do computador. O arquivo fica só em memória aqui —
 * quem consome decide quando subir para a API.
 */
export function PhotoCapture({
  value,
  onChange,
  label,
  hint,
}: {
  value: PhotoSelection | null;
  onChange: (value: PhotoSelection | null) => void;
  label: string;
  hint?: string;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cameraSupported = useCameraSupported();

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /**
   * Só o trabalho assíncrono de abrir o stream. O status "requesting" é
   * definido por quem dispara, e a checagem de suporte é feita antes de
   * chegar aqui — assim este callback nunca faz setState de forma síncrona,
   * o que permite chamá-lo de um efeito sem cascata de renders.
   */
  const startCamera = useCallback(
    async (mode: FacingMode) => {
      stopStream();
      await Promise.resolve();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("streaming");
        setError("");
      } catch (err) {
        stopStream();
        setStatus("error");
        setError(cameraErrorMessage(err));
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (!cameraOpen || !cameraSupported) return;
    // Assinar a câmera (um sistema externo) é exatamente o caso que a regra
    // set-state-in-effect permite. Ela é estática e não enxerga além do
    // `async`: nenhum setState de startCamera roda no corpo deste efeito —
    // todos acontecem depois do primeiro await, em continuação assíncrona,
    // então não há cascata de renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera(facingMode);
    return stopStream;
  }, [cameraOpen, cameraSupported, facingMode, startCamera, stopStream]);

  // Libera o object URL da preview anterior ao trocar/limpar a seleção.
  useEffect(() => {
    return () => {
      if (value) URL.revokeObjectURL(value.previewUrl);
    };
  }, [value]);

  function capture() {
    const video = videoRef.current;
    if (!video || status !== "streaming" || !video.videoWidth) {
      setError("A câmera ainda não entregou imagem. Tente novamente.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Não foi possível gerar a foto.");
          return;
        }
        const file = new File([blob], `captura-${Date.now()}.jpg`, { type: "image/jpeg" });
        onChange({ file, source: "camera", previewUrl: URL.createObjectURL(file) });
        stopStream();
        setCameraOpen(false);
        setStatus("idle");
      },
      "image/jpeg",
      0.92,
    );
  }

  function pickFromComputer(file: File | undefined) {
    if (!file) return;
    onChange({ file, source: "computer", previewUrl: URL.createObjectURL(file) });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {hint ?? "Opcional. Fica anexada ao registro e ao histórico."}
          </p>
        </div>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-4" />
            Remover
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-md border bg-muted">
        {cameraOpen ? (
          <div className="space-y-2">
            <div className="relative aspect-video bg-black">
              <video ref={videoRef} playsInline muted autoPlay className="size-full object-contain" />
              {status === "requesting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                  <RefreshCw className="size-6 animate-spin" />
                  <span className="text-xs">Aceite a permissão do navegador…</span>
                </div>
              )}
              {status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                  <CameraOff className="size-6" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setCameraOpen(false)}>
                Voltar
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatus("requesting");
                  setFacingMode((mode) => (mode === "environment" ? "user" : "environment"));
                }}
              >
                {facingMode === "environment" ? "Usar frontal" : "Usar traseira"}
              </Button>
              {status === "error" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setStatus("requesting");
                    void startCamera(facingMode);
                  }}
                >
                  <RefreshCw className="size-4" />
                  Tentar novamente
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={capture} disabled={status !== "streaming"}>
                  <Camera className="size-4" />
                  Capturar
                </Button>
              )}
            </div>
          </div>
        ) : value ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.previewUrl} alt="Foto selecionada" className="max-h-64 w-full object-contain" />
            <p className="flex items-center gap-1.5 p-2 text-xs text-muted-foreground">
              <Check className="size-4 text-[var(--success)]" />
              {value.source === "camera" ? "Capturada agora" : value.file.name}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <Camera className="size-7 text-muted-foreground" />
            <p className="text-sm font-medium">Registro do momento</p>
            <p className="text-xs text-muted-foreground">
              A permissão da câmera é pedida na primeira utilização.
            </p>
          </div>
        )}
      </div>

      {!cameraOpen && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (!cameraSupported) {
                setError(cameraErrorMessage(null));
                return;
              }
              setError("");
              setStatus("requesting");
              setCameraOpen(true);
            }}
          >
            <Camera className="size-4" />
            Tirar foto agora
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <MonitorUp className="size-4" />
            Importar do computador
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          pickFromComputer(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
