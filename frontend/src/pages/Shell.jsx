import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import FlightPlanning from "./FlightPlanning";
import RunwayAnalysis from "./RunwayAnalysis";
import WeightBalance  from "./WeightBalance";
import s from "./Shell.module.css";

const TABS = [
  { id: "flights",  label: "Flight Planning", icon: "✈" },
  { id: "runway",   label: "Runway Analysis", icon: "⬜" },
  { id: "wb",       label: "W & B",           icon: "⚖" },
];

export default function Shell() {
  const { user, logout } = useAuth();
  const [tab, setTab]    = useState("flights");

  return (
    <div className={s.root}>
      {/* Top nav */}
      <header className={s.header}>
        <div className={s.brand}>
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="7" fill="var(--accent)"/>
            <path d="M8 24l6-12 4 8 3-5 7 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={s.brandName}>AS</span>
          <span className={s.brandFull}>Aircraft Solutions</span>
        </div>

        <nav className={s.tabs}>
          {TABS.map(t => (
            <button key={t.id} className={`${s.tab} ${tab === t.id ? s.active : ""}`}
              onClick={() => setTab(t.id)}>
              <span className={s.tabIcon}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className={s.user}>
          <div className={s.userInfo}>
            <span className={s.userName}>{user?.name}</span>
            <span className={s.userRole}>{user?.cert}</span>
          </div>
          <button className={s.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      {/* Page content */}
      <main className={s.main}>
        {tab === "flights" && <FlightPlanning />}
        {tab === "runway"  && <RunwayAnalysis />}
        {tab === "wb"      && <WeightBalance  />}
      </main>
    </div>
  );
}
