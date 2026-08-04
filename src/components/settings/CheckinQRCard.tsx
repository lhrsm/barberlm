import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import { Download, RefreshCw, QrCode } from "lucide-react";
import { toast } from "sonner";

export function CheckinQRCard() {
  const [token, setToken] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://barbex.shop";
  const url = token && slug ? `${origin}/${slug}/checkin?t=${token}` : "";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("checkin_token, slug, business_name").eq("id", user.id).maybeSingle();
      setToken((data as any)?.checkin_token ?? null);
      setSlug((data as any)?.slug ?? null);
      setBusinessName((data as any)?.business_name ?? "Barbex");
      setLoading(false);
    })();
  }, []);

  const rotate = async () => {
    if (!confirm("Gerar novo QR? O QR antigo deixará de funcionar.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("profiles").update({ checkin_token: newToken } as any).eq("id", user.id);
    if (error) { toast.error("Erro ao gerar novo QR"); return; }
    setToken(newToken);
    toast.success("Novo QR gerado. Reimprima e exponha na recepção.");
  };

  const download = () => {
    const svg = document.getElementById("checkin-qr-svg") as unknown as SVGElement | null;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 1024;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const link = document.createElement("a");
      link.download = `qr-checkin-${slug || "barbex"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) return null;

  return (
    <Card className="border-2" style={{ borderColor: "#D4AF37" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><QrCode className="w-5 h-5" style={{ color: "#D4AF37" }} /> QR Code de Check-in</CardTitle>
        <p className="text-sm text-muted-foreground">Imprima e exponha na recepção. Os clientes escaneiam ao chegar e confirmam seu agendamento.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {token && slug ? (
          <>
            <div className="bg-white p-6 rounded-lg flex flex-col items-center gap-3">
              <QRCodeSVG id="checkin-qr-svg" value={url} size={220} level="M" includeMargin />
              <p className="text-black text-sm font-semibold text-center">Check-in {businessName}</p>
              <p className="text-black/60 text-xs text-center break-all">{url}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={download} className="flex-1" style={{ background: "#D4AF37", color: "#000" }}>
                <Download className="w-4 h-4 mr-2" /> Baixar PNG
              </Button>
              <Button onClick={rotate} variant="outline" className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" /> Novo QR
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Salve suas configurações para ativar o QR de check-in.</p>
        )}
      </CardContent>
    </Card>
  );
}
