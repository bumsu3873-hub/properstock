"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "..//../supabase";

const seed = [
  { id: 1, name: "SK하이닉스", eps: "55000", per: "9", price: "420000" },
  { id: 2, name: "삼성전자", eps: "6500", per: "12", price: "78000" },
  { id: 3, name: "마이크론", eps: "12.5", per: "11", price: "120" },
];

const fmt = (n) =>
  isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";

function Row({ row, onChange, onRemove }) {
  const eps = parseFloat(row.eps);
  const per = parseFloat(row.per);
  const price = parseFloat(row.price);
  const fair = eps * per;
  const gap = ((fair - price) / price) * 100;
  const valid = isFinite(fair) && isFinite(gap) && price > 0;
  const under = gap >= 0;
  const sig = under ? "#1A7F5A" : "#C8432B";
  const pct = valid ? Math.max(-50, Math.min(50, gap)) : 0;

  const field = (key, label, prefix) => (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 11, color: "#6B6B73", marginBottom: 4 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: "1.5px solid #E4E3DD", paddingBottom: 3 }}>
        {prefix && <span style={{ fontSize: 13, color: "#6B6B73" }}>{prefix}</span>}
        <input
          value={row[key]}
          onChange={(e) => onChange({ ...row, [key]: e.target.value.replace(/[^0-9.]/g, "") })}
          inputMode="decimal"
          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 15, color: "#17171C", padding: 0 }}
        />
      </div>
    </label>
  );

  return (
    <div style={{ background: "#fff", border: "1px solid #E4E3DD", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <input
          value={row.name}
          onChange={(e) => onChange({ ...row, name: e.target.value })}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 17, fontWeight: 700, color: "#17171C" }}
        />
        <button onClick={onRemove} style={{ border: "none", background: "transparent", color: "#6B6B73", fontSize: 13, cursor: "pointer", padding: 4 }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
        {field("eps", "Forward EPS", "")}
        {field("per", "목표 PER", "×")}
        {field("price", "현재가", "")}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "#6B6B73", marginBottom: 2 }}>적정가</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#17171C" }}>{valid ? fmt(fair) : "—"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6B6B73", marginBottom: 2 }}>{under ? "저평가" : "고평가"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: sig }}>{valid ? `${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%` : "—"}</div>
        </div>
      </div>
      {valid && (
        <div style={{ position: "relative", height: 6, background: "#F4F4F0", borderRadius: 99, marginTop: 6 }}>
          <div style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1.5, background: "#E4E3DD" }} />
          <div style={{ position: "absolute", top: "50%", left: `${50 + pct}%`, width: 12, height: 12, borderRadius: 99, background: sig, transform: "translate(-50%,-50%)", border: "2px solid #fff" }} />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [rows, setRows] = useState(seed);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const update = (i, r) => setRows(rows.map((x, idx) => (idx === i ? r : x)));
  const remove = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const add = () => setRows([...rows, { id: Date.now(), name: "새 종목", eps: "", per: "", price: "" }]);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F4F0", fontFamily: "sans-serif", color: "#17171C" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "28px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 99, background: "#0E4D45" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0E4D45", letterSpacing: "0.08em" }}>누가 버는가</span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          {user ? (
            <button onClick={logout} style={{ border: "1px solid #E4E3DD", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#6B6B73", cursor: "pointer" }}>
              로그아웃
            </button>
          ) : (
            <button onClick={login} style={{ border: "none", background: "#0E4D45", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              구글로 로그인
            </button>
          )}
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}>적정가 계산기</h1>
        <p style={{ fontSize: 13, color: "#6B6B73", margin: "0 0 22px", lineHeight: 1.5 }}>
          forward EPS × 목표 PER = 적정가. 현재가랑 비교해서 싼지 비싼지 1초에.
        </p>

        {rows.map((r, i) => (
          <Row key={r.id} row={r} onChange={(nr) => update(i, nr)} onRemove={() => remove(i)} />
        ))}

        <button onClick={add} style={{ width: "100%", padding: 13, marginTop: 4, borderRadius: 12, border: "1.5px dashed #E4E3DD", background: "transparent", color: "#6B6B73", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          + 종목 추가
        </button>

        <p style={{ fontSize: 11, color: "#6B6B73", marginTop: 22, textAlign: "center" }}>
          정보 제공용 · 종목 추천 아님 · 투자 판단은 본인 책임
        </p>
      </div>
    </div>
  );
}
