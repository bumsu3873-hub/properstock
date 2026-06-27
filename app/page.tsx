"use client";

import React, { useState } from "react";
import { supabase } from "../supabase";

// ──────────────────────────────────────────────────────────────
// properstock · 메모리 반도체 적정가 대시보드 (공개 v1)
//
// 핵심: 적정가 = 선행 EPS × 적정 PER  /  괴리율 = (적정가-현재가)/현재가
// 미끼(lead magnet)용 공개 페이지. 로그인 없이 4종목 적정가가 바로 뜬다.
// 사용자가 적정 PER·EPS·현재가를 직접 만질 수 있는 게 네이버엔 없는 차별점.
//
// 숫자 출처: FnGuide 12개월 선행 PER 역산 (기준일 2026-06-26)
//   삼성 6.48배 / 하이닉스 6.98배 / 마이크론 11.2배 / 샌디스크 12.3배
// 투자자문 아님 — 입력값 기반 단순 계산기. (유사투자자문 라인 회피용 면책 하단)
// ──────────────────────────────────────────────────────────────

const BASE_DATE = "2026-06-26";

// perCons = 현재 선행PER(보수: 지금 멀티플 유지)
// perAgg  = 공격(한국이 미국 피어 12배까지 재평가 / 미국은 피어 유지)
const SEED = [
  { id: "samsung", name: "삼성전자", ticker: "005930", cur: "KRW", price: 340500,  eps: 52500,  perCons: 6.5,  perAgg: 12, note: "메모리 회복 + HBM 추격이 12배 정당화 근거. 리스크: HBM3E 엔비디아 납품 지연, 파운드리 적자." },
  { id: "hynix",   name: "SK하이닉스", ticker: "000660", cur: "KRW", price: 2700000, eps: 370000, perCons: 7.0,  perAgg: 12, note: "HBM 1위·LTA로 이익 가시성 확보 = 12배 정당화. 리스크: CXMT 범용 D램 공급 과잉, 외국인 수급 이탈." },
  { id: "micron",  name: "마이크론",   ticker: "MU",     cur: "USD", price: 1030,    eps: 92,     perCons: 11.2, perAgg: 12, note: "FY26 Q3 서프라이즈로 신고가, 12배면 거의 적정. 리스크: '셀 더 뉴스' 패턴 + 실적 정점 역PER 트랩." },
  { id: "sandisk", name: "샌디스크",   ticker: "SNDK",   cur: "USD", price: 2200,    eps: 179,    perCons: 12.3, perAgg: 12, note: "NAND 순수 플레이 + AI 스토리지 수요 수혜. 리스크: NAND 가격 변동성, D램보다 약한 공급 조절." },
];

const C = {
  ink: "#14151A",
  paper: "#FAFAF7",
  card: "#FFFFFF",
  line: "#E7E6DF",
  muted: "#6E6E73",
  petrol: "#0C4A43", // 저평가 (살 만함)
  petrolBg: "#E8F1EE",
  clay: "#C24A2E",   // 고평가
  clayBg: "#F8ECE7",
  amber: "#B8862E",
};

function nf(n, cur) {
  if (!isFinite(n)) return "—";
  if (cur === "KRW") return Math.round(n).toLocaleString("ko-KR");
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
}
function priceLabel(n, cur) {
  return cur === "KRW" ? `${nf(n, cur)}원` : `$${nf(n, cur)}`;
}

function Field({ value, cur, onChange, width = 96 }) {
  return (
    <input
      className="ps-input"
      style={{ width }}
      value={value}
      inputMode="decimal"
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.]/g, "");
        onChange(v === "" ? 0 : parseFloat(v));
      }}
    />
  );
}

function StockCard({ row, onEdit }) {
  const fair = row.eps * row.targetPer;
  const gap = ((fair - row.price) / row.price) * 100;
  const under = gap >= 0;
  const sig = under ? C.petrol : C.clay;
  const sigBg = under ? C.petrolBg : C.clayBg;
  // 게이지: 중앙=현재가. 저평가면 오른쪽으로(초록), 고평가면 왼쪽으로(빨강). ±100% 클램프.
  const mag = Math.min(Math.abs(gap), 100) / 100; // 0~1
  const half = mag * 50;

  return (
    <div className="ps-card">
      <div className="ps-card-head">
        <div>
          <div className="ps-name">{row.name}</div>
          <div className="ps-ticker">{row.ticker}</div>
        </div>
        <div className="ps-verdict" style={{ color: sig, background: sigBg }}>
          {under ? "저평가" : "고평가"} {under ? "+" : ""}{gap.toFixed(1)}%
        </div>
      </div>

      <div className="ps-gauge">
        <div className="ps-gauge-track" />
        <div className="ps-gauge-center" />
        <div
          className="ps-gauge-fill"
          style={{
            background: sig,
            left: under ? "50%" : `${50 - half}%`,
            width: `${half}%`,
          }}
        />
        <div className="ps-gauge-cap" style={{ left: "50%", background: C.ink }} title="현재가" />
        <div
          className="ps-gauge-cap"
          style={{ left: `${under ? 50 + half : 50 - half}%`, background: sig }}
          title="적정가"
        />
      </div>
      <div className="ps-gauge-legend">
        <span><i style={{ background: C.ink }} />현재가</span>
        <span><i style={{ background: sig }} />적정가</span>
      </div>

      <div className="ps-grid">
        <label className="ps-cell">
          <span>현재가</span>
          <div className="ps-cell-edit">
            <Field value={row.price} cur={row.cur} onChange={(v) => onEdit(row.id, "price", v)} />
            <em>{row.cur === "KRW" ? "원" : "$"}</em>
          </div>
        </label>
        <label className="ps-cell">
          <span>선행 EPS</span>
          <div className="ps-cell-edit">
            <Field value={row.eps} cur={row.cur} onChange={(v) => onEdit(row.id, "eps", v)} />
            <em>{row.cur === "KRW" ? "원" : "$"}</em>
          </div>
        </label>
        <label className="ps-cell">
          <span>적정 PER</span>
          <div className="ps-cell-edit">
            <Field value={row.targetPer} width={60} onChange={(v) => onEdit(row.id, "targetPer", v)} />
            <em>배</em>
          </div>
        </label>
        <div className="ps-cell ps-cell-out">
          <span>적정가</span>
          <strong style={{ color: sig }}>{priceLabel(fair, row.cur)}</strong>
        </div>
      </div>

      {row.note && <p className="ps-note">{row.note}</p>}
    </div>
  );
}

export default function ProperstockDashboard() {
  const [mode, setMode] = useState("aggressive"); // 기본: 공격
  const [rows, setRows] = useState(
    SEED.map((s) => ({ ...s, targetPer: s.perAgg }))
  );
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function applyMode(m) {
    setMode(m);
    setRows((prev) =>
      prev.map((r) => {
        const seed = SEED.find((s) => s.id === r.id);
        return { ...r, targetPer: m === "aggressive" ? seed.perAgg : seed.perCons };
      })
    );
  }
  function reset() {
    applyMode(mode);
    setRows((prev) => prev.map((r) => {
      const s = SEED.find((x) => x.id === r.id);
      return { ...r, price: s.price, eps: s.eps, targetPer: mode === "aggressive" ? s.perAgg : s.perCons };
    }));
  }
  function edit(id, key, val) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }
  async function submitEmail() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    try {
      await supabase.from("emails").insert({ email, source: "dashboard_v1" });
    } catch (_) {
      // 중복 가입 등은 조용히 넘김 — 사용자 경험은 동일하게 "신청 완료"
    }
    setSent(true);
  }

  return (
    <div className="ps-root">
      <style>{styles}</style>

      <header className="ps-header">
        <div className="ps-topbar">
          <div className="ps-brand">
            properstock
            <span className="ps-brand-dot" />
          </div>
          {/* Next.js: /app = 로그인해서 내 종목 저장하는 기존 계산기 */}
          <a className="ps-login" href="/app">내 종목 저장 →</a>
        </div>
        <div className="ps-eyebrow">메모리 반도체 적정가</div>
        <h1 className="ps-title">
          삼성·하이닉스·마이크론·샌디스크,<br />
          <span className="ps-title-accent">지금 싸냐 비싸냐</span>를 1초 만에.
        </h1>
        <p className="ps-lede">
          선행 EPS × 적정 PER로 적정가를 계산합니다. 숫자는 직접 바꿔도 됩니다.
          기준일 {BASE_DATE} · FnGuide 12개월 선행 PER 기준.
        </p>

        <div className="ps-toggle" role="tablist" aria-label="밸류에이션 시나리오">
          <button
            role="tab"
            aria-selected={mode === "conservative"}
            className={mode === "conservative" ? "on" : ""}
            onClick={() => applyMode("conservative")}
          >
            보수 <em>현 멀티플 유지</em>
          </button>
          <button
            role="tab"
            aria-selected={mode === "aggressive"}
            className={mode === "aggressive" ? "on" : ""}
            onClick={() => applyMode("aggressive")}
          >
            공격 <em>피어 12배 재평가</em>
          </button>
          <button className="ps-reset" onClick={reset}>초기화</button>
        </div>
        <p className="ps-scenario-note">
          {mode === "aggressive"
            ? "한국 메모리가 미국 피어 수준(12배)까지 재평가된다고 볼 때. 업사이드가 한국에 쏠립니다."
            : "지금 시장이 매기는 선행 PER을 그대로 유지한다고 볼 때."}
        </p>
      </header>

      <main className="ps-cards">
        {rows.map((r) => (
          <StockCard key={r.id} row={r} onEdit={edit} />
        ))}
      </main>

      <section className="ps-capture">
        {!sent ? (
          <>
            <div className="ps-capture-copy">
              <strong>적정가가 바뀌면 알려드릴까요?</strong>
              <span>종목별 컨센서스가 갱신되면 메일로 보냅니다. 광고 없음.</span>
            </div>
            <div className="ps-capture-form">
              <input
                className="ps-email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitEmail()}
              />
              <button className="ps-email-btn" onClick={submitEmail}>알림 신청</button>
            </div>
          </>
        ) : (
          <div className="ps-capture-done">
            신청됐습니다. 갱신되면 <b>{email}</b>로 보내드릴게요.
          </div>
        )}
      </section>

      <footer className="ps-foot">
        적정가는 입력값에 기반한 단순 계산이며, 투자 자문이나 매매 권유가 아닙니다.
        메모리는 이익 정점에서 PER이 가장 낮게 보이는 ‘역PER 트랩’이 있어, 낮은 PER이
        곧 저평가를 뜻하지 않을 수 있습니다. 투자 판단과 책임은 본인에게 있습니다.
      </footer>
    </div>
  );
}

const styles = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

.ps-root{
  --ink:${C.ink};--paper:${C.paper};--card:${C.card};--line:${C.line};--muted:${C.muted};
  --petrol:${C.petrol};--clay:${C.clay};--amber:${C.amber};
  font-family:'Pretendard',system-ui,sans-serif;
  background:var(--paper);color:var(--ink);
  max-width:760px;margin:0 auto;padding:34px 20px 48px;
  -webkit-font-smoothing:antialiased;
}
.ps-root *{box-sizing:border-box;}

.ps-header{margin-bottom:22px;}
.ps-topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;}
.ps-login{font-size:12.5px;font-weight:700;color:var(--petrol);text-decoration:none;
  border:1px solid var(--line);border-radius:9px;padding:7px 12px;background:var(--card);white-space:nowrap;transition:.15s;}
.ps-login:hover{border-color:var(--petrol);background:${C.petrolBg};}
.ps-brand{font-weight:800;letter-spacing:-.02em;font-size:18px;display:flex;align-items:center;gap:7px;}
.ps-brand-dot{width:7px;height:7px;border-radius:50%;background:var(--petrol);display:inline-block;}
.ps-eyebrow{margin-top:20px;font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--petrol);}
.ps-title{font-size:30px;line-height:1.18;font-weight:800;letter-spacing:-.03em;margin:9px 0 0;}
.ps-title-accent{background:linear-gradient(transparent 62%, #C7E3DB 62%);padding:0 2px;}
.ps-lede{color:var(--muted);font-size:13.5px;line-height:1.6;margin:14px 0 0;max-width:54ch;}

.ps-toggle{display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;align-items:stretch;}
.ps-toggle button{
  border:1px solid var(--line);background:var(--card);color:var(--ink);
  border-radius:11px;padding:9px 14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;
  display:flex;flex-direction:column;gap:1px;line-height:1.15;transition:.15s;
}
.ps-toggle button em{font-style:normal;font-weight:500;font-size:11px;color:var(--muted);}
.ps-toggle button.on{border-color:var(--ink);background:var(--ink);color:#fff;}
.ps-toggle button.on em{color:#cfd3d0;}
.ps-reset{margin-left:auto;align-self:center;border:none!important;background:none!important;color:var(--muted)!important;
  font-size:12px!important;font-weight:600!important;text-decoration:underline;padding:6px!important;}
.ps-scenario-note{font-size:12.5px;color:var(--muted);margin:11px 0 0;line-height:1.5;}

.ps-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px;}
@media(max-width:560px){.ps-cards{grid-template-columns:1fr;}.ps-title{font-size:25px;}}

.ps-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 16px 14px;}
.ps-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
.ps-name{font-weight:800;font-size:16px;letter-spacing:-.02em;}
.ps-ticker{font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);margin-top:1px;}
.ps-verdict{font-size:12.5px;font-weight:800;padding:5px 9px;border-radius:8px;white-space:nowrap;font-family:'Space Mono',monospace;}

.ps-gauge{position:relative;height:14px;margin:16px 0 6px;}
.ps-gauge-track{position:absolute;top:6px;left:0;right:0;height:2px;background:var(--line);border-radius:2px;}
.ps-gauge-center{position:absolute;top:1px;left:50%;width:1px;height:12px;background:#c9c9c2;transform:translateX(-.5px);}
.ps-gauge-fill{position:absolute;top:5px;height:4px;border-radius:3px;transition:.35s cubic-bezier(.4,0,.2,1);}
.ps-gauge-cap{position:absolute;top:2px;width:3px;height:10px;border-radius:2px;transform:translateX(-1.5px);transition:.35s cubic-bezier(.4,0,.2,1);}
.ps-gauge-legend{display:flex;gap:14px;font-size:10.5px;color:var(--muted);margin-bottom:12px;}
.ps-gauge-legend span{display:flex;align-items:center;gap:4px;}
.ps-gauge-legend i{width:7px;height:3px;border-radius:2px;display:inline-block;}

.ps-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px;}
.ps-cell{display:flex;flex-direction:column;gap:4px;}
.ps-cell>span{font-size:11px;color:var(--muted);font-weight:600;}
.ps-cell-edit{display:flex;align-items:center;gap:4px;}
.ps-cell-edit em{font-style:normal;font-size:12px;color:var(--muted);}
.ps-cell-out{justify-content:space-between;}
.ps-cell-out strong{font-family:'Space Mono',monospace;font-size:15px;font-weight:700;}
.ps-input{
  font-family:'Space Mono',monospace;font-size:13.5px;font-weight:700;color:var(--ink);
  border:1px solid var(--line);border-radius:7px;padding:5px 7px;background:#fff;text-align:right;
}
.ps-input:focus{outline:none;border-color:var(--petrol);box-shadow:0 0 0 2px ${C.petrolBg};}

.ps-note{margin:12px 0 0;padding-top:11px;border-top:1px dashed var(--line);
  font-size:11.5px;line-height:1.55;color:var(--muted);letter-spacing:-.005em;}

.ps-capture{margin-top:18px;background:var(--ink);color:#fff;border-radius:16px;padding:18px;
  display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;}
.ps-capture-copy{display:flex;flex-direction:column;gap:3px;}
.ps-capture-copy strong{font-size:15px;font-weight:800;letter-spacing:-.02em;}
.ps-capture-copy span{font-size:12.5px;color:#b9bdba;}
.ps-capture-form{display:flex;gap:8px;flex:1;min-width:230px;}
.ps-email{flex:1;border:none;border-radius:9px;padding:10px 12px;font-family:inherit;font-size:13.5px;}
.ps-email:focus{outline:2px solid var(--amber);}
.ps-email-btn{border:none;border-radius:9px;padding:10px 16px;background:#fff;color:var(--ink);
  font-family:inherit;font-weight:800;font-size:13.5px;cursor:pointer;white-space:nowrap;}
.ps-capture-done{font-size:14px;}
.ps-capture-done b{font-family:'Space Mono',monospace;}

.ps-foot{margin-top:20px;font-size:11px;line-height:1.6;color:var(--muted);}
`;
