import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button, Input, ErrorBox } from "../components/UI";
import s from "./Login.module.css";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]   = useState("pilot@aircraftsolutions.com");
  const [pass,  setPass]    = useState("demo1234");
  const [err,   setErr]     = useState("");
  const [busy,  setBusy]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await login(email, pass); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className={s.root}>
      <div className={s.panel}>
        <div className={s.logo}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="var(--accent)"/>
            <path d="M8 24l6-12 4 8 3-5 7 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div className={s.logoName}>Aircraft Solutions</div>
            <div className={s.logoSub}>Flight Operations Portal</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={s.form}>
          <h1 className={s.title}>Sign in</h1>
          <p className={s.hint}>Demo: <code>pilot@aircraftsolutions.com</code> / <code>demo1234</code></p>

          <Input label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} autoFocus />
          <Input label="Password" type="password" value={pass}
            onChange={e => setPass(e.target.value)} />

          <ErrorBox message={err} />
          <Button type="submit" loading={busy} style={{ width: "100%" }}>Sign In</Button>
        </form>

        <p className={s.footer}>
          Data computed via <strong>OpenAP</strong> · Weather via <strong>aviationweather.gov</strong>
        </p>
      </div>
    </div>
  );
}
