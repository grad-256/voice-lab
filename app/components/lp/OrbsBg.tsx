// Features セクション用：浮遊するカラーオーブ（globals.css の keyframes を使用）
export default function OrbsBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="orb-1" />
      <div className="orb-2" />
      <div className="orb-3" />
    </div>
  );
}
