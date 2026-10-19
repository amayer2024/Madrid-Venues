"use client";

import { useEffect, useRef, useState } from "react";

export function DoorScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported">("off");
  const busy = useRef(false);

  async function redeem(value: string) {
    const trimmed = value.trim();
    if (!trimmed || busy.current) return;
    busy.current = true;
    const res = await fetch("/api/passes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmed }),
    });
    const data = await res.json();
    setOk(res.ok);
    setResult(res.ok ? `OK · ${data.product} · ${data.venue} · ${data.guest}` : data.error);
    busy.current = false;
  }

  useEffect(() => {
    if (camera !== "on") return;
    const Detector = (window as Window & {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
      };
    }).BarcodeDetector;
    if (!Detector) {
      setCamera("unsupported");
      return;
    }

    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const detector = new Detector({ formats: ["qr_code"] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play();
        timer = window.setInterval(async () => {
          if (!video.videoWidth || busy.current) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) {
              setCode(codes[0].rawValue);
              await redeem(codes[0].rawValue);
            }
          } catch {
            /* frame skipped */
          }
        }, 500);
      })
      .catch(() => setCamera("unsupported"));

    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);

  return (
    <section className="door-scan">
      <h2>Escanear QR</h2>
      {camera === "on" ? (
        <video ref={videoRef} className="camera" playsInline muted />
      ) : (
        <button type="button" onClick={() => setCamera("on")}>
          Abrir cámara
        </button>
      )}
      {camera === "unsupported" ? (
        <p className="muted">Este navegador no puede escanear. Introduce el código a mano.</p>
      ) : null}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void redeem(code);
        }}
      >
        <label>
          Código del pase
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Pega o escribe el código"
            required
            autoCapitalize="off"
          />
        </label>
        <button type="submit">Canjear</button>
      </form>
      {ok === true ? <p className="ok-banner">{result}</p> : null}
      {ok === false ? <p className="err-banner">{result}</p> : null}
    </section>
  );
}
