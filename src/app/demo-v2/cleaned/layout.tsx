import Script from "next/script";
import "./cleaned-v2.css";

export const metadata = {
  title: "CLEANED V2 Demo — Lukas Nilsson",
};

export default function CleanedV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cleaned-v2-scope">
      <Script src="/demo/cleaned/annotation-renderer.js" strategy="beforeInteractive" />
      <Script src="/demo/cleaned/editor.js" strategy="beforeInteractive" />
      {children}
    </div>
  );
}
