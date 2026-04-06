import "./cleaned-v2.css";

export const metadata = {
  title: "CLEANED V2 Demo — Lukas Nilsson",
};

export default function CleanedV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cleaned-v2-scope">
      {children}
    </div>
  );
}
