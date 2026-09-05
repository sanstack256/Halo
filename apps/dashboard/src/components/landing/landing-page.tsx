"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Hooks ──────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

// ─── Design Tokens ──────────────────────────────────────────────────────────

const C = {
  bg:       "#05070A",
  surface:  "#090C11",
  s2:       "#0D1118",
  s3:       "#111720",
  blue:     "#69BFFF",
  blueBr:   "#8BD3FF",
  blueDeep: "#2B8FD9",
  blueAtm:  "#0D3B61",
  // Softer white hierarchy per refinement
  textDisp: "#E8EDF3",   // primary display / headlines
  textImp:  "#C5CDD7",   // important secondary
  text2:    "#A7B0BD",   // body / supporting
  text3:    "#6F7A89",   // muted
  textMic:  "#66717F",   // technical / micro
  muted:    "#4B5563",
  border:   "rgba(255,255,255,0.06)",
  borderB:  "rgba(105,191,255,0.15)",
};

const mono = "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace";
const sans = "var(--font-geist-sans), 'Geist', system-ui, -apple-system, sans-serif";

interface LandingPageProps {
  isAuthenticated?: boolean;
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function Nav({ isAuthenticated }: { isAuthenticated?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 72,
        display: "flex",
        alignItems: "center",
        background: scrolled ? "rgba(5,7,10,0.94)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo: full wordmark (icon + text) */}
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/halo-wordmark.png"
            alt="Halo"
            style={{
              height: 36,
              width: "auto",
              mixBlendMode: "screen",
              objectFit: "contain",
            }}
          />
        </Link>

        <div className="hidden md:flex" style={{ gap: 32 }}>
          {[
            { label: "Product", href: "#evidence" },
            { label: "How it works", href: "#how-it-works" },
            { label: "Docs", href: "/sdk" },
            { label: "Pricing", href: "/pricing" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                fontFamily: sans,
                fontSize: 14,
                color: C.text3,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.textImp)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAuthenticated ? (
            <Link
              href="/overview"
              style={{
                fontFamily: sans,
                fontSize: 13,
                fontWeight: 600,
                padding: "9px 18px",
                borderRadius: 7,
                background: C.blue,
                color: C.bg,
                textDecoration: "none",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.blueBr)}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.blue)}
            >
              Open Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden sm:inline-block"
                style={{
                  fontFamily: sans,
                  fontSize: 13,
                  color: C.text3,
                  padding: "8px 14px",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.textImp)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
              >
                Log in
              </Link>
              <Link
                href="/sign-up"
                style={{
                  fontFamily: sans,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "9px 18px",
                  borderRadius: 7,
                  background: C.blue,
                  color: C.bg,
                  textDecoration: "none",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.blueBr)}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.blue)}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Hero investigation artifact ─────────────────────────────────────────────

interface NodeProps {
  visible: boolean;
  lineVisible?: boolean;
  label: string;
  title: string;
  meta: string;
  dot?: string;
  isLast?: boolean;
  indent?: boolean;
}

function ENode({ visible, lineVisible, label, title, meta, dot = C.blue, isLast, indent }: NodeProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        paddingLeft: indent ? 28 : 0,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(5px)",
        transition: "opacity 0.45s ease, transform 0.45s ease",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: visible ? dot : "transparent",
            flexShrink: 0,
            marginTop: 3,
            boxShadow: visible ? `0 0 7px ${dot}60` : "none",
            transition: "background 0.3s ease, box-shadow 0.3s ease",
          }}
        />
        {!isLast && (
          <div
            style={{
              width: 1,
              flexGrow: 1,
              minHeight: 24,
              background: "linear-gradient(to bottom, rgba(105,191,255,0.3), rgba(105,191,255,0.08))",
              transform: lineVisible ? "scaleY(1)" : "scaleY(0)",
              transformOrigin: "top center",
              transition: "transform 0.5s ease",
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: isLast ? 8 : 20, flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: "0.14em",
            color: C.textMic,
            textTransform: "uppercase",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontFamily: sans, fontSize: 13, color: C.textImp, fontWeight: 500, lineHeight: 1.4 }}>
          {title}
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.text3, marginTop: 2, wordBreak: "break-all" }}>
          {meta}
        </div>
      </div>
    </div>
  );
}

function HeroArtifact() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const delays = [350, 750, 1100, 1450, 1800, 2150, 2500, 2850, 3250];
    const timers = delays.map((d, i) => setTimeout(() => setStep(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, []);
  const v = (n: number) => step >= n;

  return (
    <div style={{ position: "relative" }}>
      {/* Primary atmospheric glow — strongest light source on the page */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-40%, -50%)",
          width: "140%",
          height: "130%",
          background: [
            "radial-gradient(ellipse 65% 60% at 52% 48%, rgba(105,191,255,0.13) 0%, rgba(43,143,217,0.05) 45%, transparent 75%)",
          ].join(", "),
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(1px)",
        }}
      />
      {/* Outer atmospheric diffusion */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-42%, -50%)",
          width: "170%",
          height: "160%",
          background: "radial-gradient(ellipse 55% 50% at 52% 48%, rgba(13,59,97,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: C.surface,
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)",
          opacity: v(1) ? 1 : 0,
          transition: "opacity 0.7s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.16em",
                color: C.textMic,
                textTransform: "uppercase",
              }}
            >
              Investigation
            </span>
            <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>#7743a</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              className={v(1) ? "glow-pulse" : ""}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.blue,
                opacity: v(1) ? 1 : 0,
                transition: "opacity 0.4s ease",
              }}
            />
            <span
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.12em",
                color: C.textMic,
                textTransform: "uppercase",
              }}
            >
              Active
            </span>
          </div>
        </div>

        <div style={{ padding: "20px 20px 4px" }}>
          <ENode
            visible={v(1)}
            lineVisible={v(2)}
            label="Error"
            title="NullPointerException"
            meta="UserService.java:247 · checkout.process()"
            dot="#f87171"
          />
          <ENode
            visible={v(3)}
            lineVisible={v(4)}
            label="Request"
            title="POST /api/checkout"
            meta="trace_id: a3f87c2e4d1a · 1 min ago"
          />
          <ENode
            visible={v(5)}
            lineVisible={v(6)}
            label="Trace"
            title="checkout.handler"
            meta="span_id: 7c2e · duration: 1.847s"
          />
          <ENode
            visible={v(7)}
            lineVisible={false}
            label="Database"
            title="SELECT * FROM orders WHERE user_id = ?"
            meta="latency: 2.4s ↑↑ · 94th pct spike"
            dot="#fbbf24"
            indent
          />
          <ENode
            visible={v(8)}
            lineVisible={false}
            label="Source"
            title="app/api/checkout/route.ts"
            meta="line 89 · getUserOrders(session.user.id)"
            isLast
          />
        </div>

        {/* Summary */}
        <div
          style={{
            margin: "8px 20px 20px",
            padding: "12px 16px",
            background: "rgba(105,191,255,0.04)",
            border: `1px solid ${C.borderB}`,
            borderRadius: 10,
            opacity: v(9) ? 1 : 0,
            transform: v(9) ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    color: C.textMic,
                    textTransform: "uppercase",
                    marginBottom: 3,
                  }}
                >
                  Confidence
                </div>
                <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.blue }}>High</div>
              </div>
              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)" }} />
              <div>
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    color: C.textMic,
                    textTransform: "uppercase",
                    marginBottom: 3,
                  }}
                >
                  Sources
                </div>
                <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 500, color: C.textImp }}>4 linked</div>
              </div>
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                color: C.muted,
                textAlign: "right",
                lineHeight: 1.5,
              }}
            >
              REQUEST BODY<br />NOT CAPTURED
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────

function Hero({ isAuthenticated }: { isAuthenticated?: boolean }) {
  return (
    <section
      id="how-it-works"
      style={{
        minHeight: "100vh",
        background: C.bg,
        // Subtle dot grid & atmospheric lighting
        backgroundImage: [
          "radial-gradient(ellipse 72% 65% at 62% 52%, rgba(105,191,255,0.055) 0%, rgba(43,143,217,0.025) 50%, transparent 72%)",
          "radial-gradient(ellipse 85% 70% at 60% 52%, rgba(13,59,97,0.12) 0%, transparent 68%)",
          "radial-gradient(ellipse 45% 50% at 22% 44%, rgba(105,191,255,0.018) 0%, transparent 65%)",
          "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "auto, auto, auto, 64px 64px, 64px 64px",
        display: "flex",
        alignItems: "center",
        padding: "120px 0 80px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px sm:0 40px", width: "100%" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[45fr_55fr] gap-12 lg:gap-20 items-center px-4 sm:px-0">
          {/* Left: copy */}
          <div>
            <div
              className="anim-fade-in-up"
              style={{
                fontFamily: mono,
                fontSize: 11,
                letterSpacing: "0.22em",
                color: C.textMic,
                textTransform: "uppercase",
                marginBottom: 24,
                animationDelay: "0.1s",
              }}
            >
              Observe · Connect · Investigate
            </div>

            <h1
              className="anim-fade-in-up"
              style={{
                fontFamily: sans,
                fontSize: "clamp(38px, 5vw, 68px)",
                lineHeight: 1.07,
                fontWeight: 600,
                color: C.textDisp,
                marginBottom: 24,
                maxWidth: 580,
                letterSpacing: "-0.025em",
                animationDelay: "0.2s",
              }}
            >
              Understand what actually broke.
            </h1>

            <p
              className="anim-fade-in-up"
              style={{
                fontFamily: sans,
                fontSize: 18,
                lineHeight: 1.72,
                color: C.text2,
                marginBottom: 40,
                maxWidth: 520,
                animationDelay: "0.35s",
              }}
            >
              Halo turns production telemetry into evidence-backed investigations — showing what happened, what the
              evidence supports, and what remains unknown.
            </p>

            <div
              className="anim-fade-in-up"
              style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, animationDelay: "0.5s" }}
            >
              <Link
                href={isAuthenticated ? "/overview" : "/sign-up"}
                style={{
                  fontFamily: sans,
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "12px 24px",
                  borderRadius: 8,
                  background: C.blue,
                  color: C.bg,
                  textDecoration: "none",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.blueBr)}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.blue)}
              >
                {isAuthenticated ? "Open Dashboard" : "Get started"}
              </Link>
              <a
                href="#evidence"
                style={{
                  fontFamily: sans,
                  fontSize: 14,
                  color: C.text2,
                  padding: "12px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.textImp)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.text2)}
              >
                See how it works <span style={{ opacity: 0.55 }}>→</span>
              </a>
            </div>
          </div>

          {/* Right: artifact */}
          <div className="anim-fade-in" style={{ animationDelay: "0.45s" }}>
            <HeroArtifact />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Big Idea Section ────────────────────────────────────────────────────────

function BigIdea() {
  const [ref, inView] = useInView(0.3);
  const base = (d = 0) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.7s ease ${d}s, transform 0.7s ease ${d}s`,
  });

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        padding: "128px 24px",
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Subtle atmospheric continuation from hero */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "70%",
          height: "200%",
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(105,191,255,0.04) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        <div
          style={{
            width: 40,
            height: 1,
            background: "rgba(105,191,255,0.35)",
            margin: "0 auto 52px",
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        />

        <p
          style={{
            fontFamily: sans,
            fontSize: "clamp(26px, 3.5vw, 44px)",
            lineHeight: 1.35,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            ...base(0.1),
          }}
        >
          <span style={{ color: C.text3 }}>Observability gives you data.</span>
          <br />
          <span style={{ color: C.textDisp }}>Investigation gives it meaning.</span>
        </p>

        <div
          style={{
            width: 40,
            height: 1,
            background: "rgba(105,191,255,0.35)",
            margin: "52px auto 0",
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s ease 0.35s",
          }}
        />
      </div>
    </section>
  );
}

// ─── Telemetry → Evidence Section ────────────────────────────────────────────

function Telemetry() {
  const [ref, inView] = useInView(0.12);

  const raw = [
    { label: "LOGS",     val: "2.4M/min" },
    { label: "REQUESTS", val: "847/s"    },
    { label: "ERRORS",   val: "0.31%"    },
    { label: "TRACES",   val: "12K/s"    },
    { label: "METRICS",  val: "340/host" },
    { label: "DATABASE", val: "4.2K qps" },
  ];

  const reveal = (d: number) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(12px)",
    transition: `opacity 0.55s ease ${d}s, transform 0.55s ease ${d}s`,
  });

  return (
    <section
      ref={ref}
      style={{
        background: C.surface,
        padding: "120px 24px sm:120px 40px",
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Very faint atmospheric trace */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "60%",
          height: "50%",
          background: "radial-gradient(ellipse 50% 60% at 50% 0%, rgba(105,191,255,0.025) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", padding: "0 16px sm:0" }}>
        <div style={{ marginBottom: 80 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMic,
              textTransform: "uppercase",
              marginBottom: 14,
              ...reveal(0),
            }}
          >
            From telemetry to evidence
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 44px)",
              fontWeight: 600,
              color: C.textDisp,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              maxWidth: 560,
              ...reveal(0.1),
            }}
          >
            Halo doesn&apos;t collect telemetry.
            <br />
            <span style={{ color: C.text2, fontWeight: 400 }}>It connects it.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-10 lg:gap-12 items-center">
          {/* Raw inputs */}
          <div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.16em",
                color: C.muted,
                textTransform: "uppercase",
                marginBottom: 20,
                ...reveal(0.2),
              }}
            >
              Raw Telemetry
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {raw.map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 13px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 7,
                    opacity: inView ? 0.7 + (i % 3) * 0.1 : 0,
                    transform: inView ? "translateX(0)" : "translateX(-10px)",
                    transition: `opacity 0.5s ease ${0.2 + i * 0.07}s, transform 0.5s ease ${0.2 + i * 0.07}s`,
                  }}
                >
                  <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", color: C.text3 }}>
                    {item.label}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* HALO center connector */}
          <div className="hidden md:flex" style={{ flexDirection: "column", alignItems: "center", gap: 12, ...reveal(0.5) }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ width: 1, height: 7, background: `rgba(105,191,255,${0.12 + i * 0.06})` }} />
            ))}
            <div
              style={{
                padding: "9px 18px",
                background: "rgba(105,191,255,0.05)",
                border: "1px solid rgba(105,191,255,0.22)",
                borderRadius: 8,
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.18em",
                color: C.blue,
                textTransform: "uppercase",
              }}
            >
              HALO
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ width: 1, height: 7, background: `rgba(105,191,255,${0.12 + (4 - i) * 0.06})` }} />
            ))}
          </div>

          {/* Evidence output */}
          <div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.16em",
                color: C.muted,
                textTransform: "uppercase",
                marginBottom: 20,
                ...reveal(0.55),
              }}
            >
              Investigation
            </div>
            <div
              style={{
                padding: "22px",
                background: "rgba(105,191,255,0.03)",
                border: "1px solid rgba(105,191,255,0.13)",
                borderRadius: 12,
                opacity: inView ? 1 : 0,
                transform: inView ? "translateX(0)" : "translateX(10px)",
                transition: "opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s",
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: C.blue,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Investigation #7743a
              </div>
              <div
                style={{
                  fontFamily: sans,
                  fontSize: 14,
                  color: C.textImp,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
                Database latency spike during checkout
              </div>
              {[
                { k: "Confidence", v: "High",    vc: C.blue  },
                { k: "Sources",    v: "4 linked", vc: C.textImp },
                { k: "Unknown",    v: "1 gap",    vc: C.text3 },
              ].map((row) => (
                <div
                  key={row.k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.text3 }}>{row.k}</span>
                  <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 500, color: row.vc }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Evidence Graph Section ───────────────────────────────────────────────────

function EvidenceGraph() {
  const [ref, inView] = useInView(0.2);

  const nodes = {
    error:    { x: 350, y: 52,  label: "ERROR",    dot: "#f87171" },
    request:  { x: 110, y: 180, label: "REQUEST",  dot: C.blue   },
    trace:    { x: 350, y: 180, label: "TRACE",    dot: C.blue   },
    source:   { x: 590, y: 180, label: "SOURCE",   dot: C.blue   },
    database: { x: 350, y: 300, label: "DATABASE", dot: "#fbbf24"},
  };

  const edges = [
    { a: nodes.error, b: nodes.request,  d: 0.3  },
    { a: nodes.error, b: nodes.trace,    d: 0.5  },
    { a: nodes.error, b: nodes.source,   d: 0.7  },
    { a: nodes.trace, b: nodes.database, d: 0.95 },
  ];

  function len(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

  const reveal = (d = 0) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(14px)",
    transition: `opacity 0.6s ease ${d}s, transform 0.6s ease ${d}s`,
  });

  return (
    <section
      id="evidence"
      ref={ref}
      style={{
        background: C.bg,
        padding: "120px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Atmospheric blue behind the evidence network */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -45%)",
          width: "700px",
          height: "500px",
          background: [
            "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(105,191,255,0.07) 0%, rgba(43,143,217,0.03) 45%, transparent 70%)",
            "radial-gradient(ellipse 40% 35% at 50% 50%, rgba(13,59,97,0.14) 0%, transparent 65%)",
          ].join(", "),
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1, padding: "0 16px sm:0" }}>
        <div style={{ marginBottom: 72 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMic,
              textTransform: "uppercase",
              marginBottom: 14,
              ...reveal(0),
            }}
          >
            Evidence relationships
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 44px)",
              fontWeight: 600,
              color: C.textDisp,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              ...reveal(0.1),
            }}
          >
            Every failure leaves a trail.
            <br />
            <span style={{ color: C.text2, fontWeight: 400 }}>Halo follows it.</span>
          </h2>
        </div>

        <div style={{ display: "flex", justifyContent: "center", width: "100%", overflowX: "auto" }}>
          <svg
            width="700"
            height="360"
            viewBox="0 0 700 360"
            style={{ overflow: "visible", maxWidth: "100%", height: "auto" }}
          >
            {/* Subtle glow circles behind nodes */}
            {Object.values(nodes).map((n, i) => (
              <circle
                key={`glow-${n.label}`}
                cx={n.x}
                cy={n.y}
                r={32}
                fill={n.dot}
                style={{
                  opacity: inView ? 0.04 : 0,
                  transition: `opacity 0.6s ease ${0.2 + i * 0.12}s`,
                  filter: "blur(8px)",
                }}
              />
            ))}
            {edges.map((e, i) => {
              const l = len(e.a, e.b);
              return (
                <line
                  key={i}
                  x1={e.a.x}
                  y1={e.a.y}
                  x2={e.b.x}
                  y2={e.b.y}
                  stroke="rgba(105,191,255,0.28)"
                  strokeWidth="1"
                  style={{
                    strokeDasharray: l,
                    strokeDashoffset: inView ? 0 : l,
                    transition: `stroke-dashoffset 0.75s ease ${e.d}s`,
                  }}
                />
              );
            })}
            {Object.values(nodes).map((n, i) => (
              <g key={n.label}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={16}
                  fill={n.dot}
                  style={{ opacity: inView ? 0.07 : 0, transition: `opacity 0.4s ease ${0.1 + i * 0.12}s` }}
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={5}
                  fill={n.dot}
                  style={{ opacity: inView ? 1 : 0, transition: `opacity 0.4s ease ${0.1 + i * 0.12}s` }}
                />
                <text
                  x={n.x}
                  y={n.y - 19}
                  textAnchor="middle"
                  fill={C.textMic}
                  fontSize="9.5"
                  fontFamily={mono}
                  letterSpacing="1.6"
                  style={{ opacity: inView ? 1 : 0, transition: `opacity 0.5s ease ${0.15 + i * 0.12}s` }}
                >
                  {n.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <p
          style={{
            fontFamily: sans,
            textAlign: "center",
            fontSize: 16,
            lineHeight: 1.75,
            color: C.text3,
            maxWidth: 520,
            margin: "48px auto 0",
            ...reveal(1.3),
          }}
        >
          An error is not an event in isolation — it is a node in a network of evidence. Requests, traces, database
          calls, and source context are all connected.
        </p>
      </div>
    </section>
  );
}

// ─── Trust Section ────────────────────────────────────────────────────────────

function Trust() {
  const [ref, inView] = useInView(0.15);

  const limits = [
    {
      label: "DATABASE TELEMETRY NOT OBSERVED",
      desc:  "Query parameters were not sampled for this span. The database call is visible, but its contents are not.",
    },
    {
      label: "REQUEST BODY NOT CAPTURED",
      desc:  "The request payload was not logged for this trace. Halo can confirm the endpoint was called, but not its contents.",
    },
    {
      label: "INSUFFICIENT EVIDENCE",
      desc:  "3 spans were dropped during the high-load period. Halo's analysis reflects only observed data.",
    },
  ];

  return (
    <section
      ref={ref}
      style={{
        background: C.surface,
        padding: "120px 24px",
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Intentionally quiet — only the faintest atmospheric trace */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "50%",
          height: "40%",
          background: "radial-gradient(ellipse 50% 60% at 50% 0%, rgba(105,191,255,0.018) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", padding: "0 16px sm:0" }}>
        <div style={{ maxWidth: 640, marginBottom: 72 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMic,
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: inView ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}
          >
            Evidence integrity
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 44px)",
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 18,
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s",
            }}
          >
            <span style={{ color: C.textDisp }}>When the evidence isn&apos;t enough, </span>
            <span style={{ color: C.blue }}>Halo says so.</span>
          </h2>
          <p
            style={{
              fontFamily: sans,
              fontSize: 17,
              lineHeight: 1.72,
              color: C.text3,
              opacity: inView ? 1 : 0,
              transition: "opacity 0.5s ease 0.25s",
            }}
          >
            Halo knows the difference between evidence and assumption. It doesn&apos;t fill gaps with guesses.
          </p>
        </div>

        <div>
          {limits.map((item, i) => (
            <div
              key={item.label}
              className="grid grid-cols-1 sm:grid-cols-[minmax(200px,1fr)_2fr] gap-4 sm:gap-16 items-start"
              style={{
                padding: "28px 0",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderBottom: i === limits.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(10px)",
                transition: `opacity 0.5s ease ${0.3 + i * 0.14}s, transform 0.5s ease ${0.3 + i * 0.14}s`,
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    border: "1px dashed rgba(255,255,255,0.13)",
                    borderRadius: 5,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.18)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      letterSpacing: "0.11em",
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
              <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.72, color: C.text3, margin: "4px 0 0" }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <p
          style={{
            fontFamily: sans,
            marginTop: 56,
            fontSize: 17,
            lineHeight: 1.72,
            color: C.text2,
            maxWidth: 540,
            opacity: inView ? 1 : 0,
            transition: "opacity 0.5s ease 0.8s",
          }}
        >
          These are not failures. They are trust signals. An investigation that acknowledges what it doesn&apos;t know
          is more reliable than one that doesn&apos;t.
        </p>
      </div>
    </section>
  );
}

// ─── Source Section ───────────────────────────────────────────────────────────

function Source() {
  const [ref, inView] = useInView(0.15);

  const lines = [
    { n: 85, code: "export async function POST(req: Request) {",           hl: false },
    { n: 86, code: "  const session = await getServerSession(authOptions)", hl: false },
    { n: 87, code: "  const cart = await getCartItems(session.user.id)",    hl: false },
    { n: 88, code: "",                                                      hl: false },
    { n: 89, code: "  const orders = await getUserOrders(session.user.id)", hl: true  },
    { n: 90, code: "  const inventory = await checkInventory(cart.items)",  hl: false },
    { n: 91, code: "  return processCheckout(cart, orders, inventory)",     hl: false },
    { n: 92, code: "}",                                                     hl: false },
  ];

  const reveal = (d = 0) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(16px)",
    transition: `opacity 0.6s ease ${d}s, transform 0.6s ease ${d}s`,
  });

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        padding: "120px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle atmospheric blue behind product surface */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "5%",
          width: "45%",
          height: "60%",
          background: "radial-gradient(ellipse 60% 55% at 60% 50%, rgba(105,191,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", padding: "0 16px sm:0" }}>
        <div style={{ maxWidth: 520, marginBottom: 64 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMic,
              textTransform: "uppercase",
              marginBottom: 14,
              ...reveal(0),
            }}
          >
            Source investigation
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 44px)",
              fontWeight: 600,
              color: C.textDisp,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              ...reveal(0.1),
            }}
          >
            Follow the evidence
            <br />
            <span style={{ color: C.text2, fontWeight: 400 }}>to where it happened.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12 items-start">
          <div
            style={{
              background: C.surface,
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              overflow: "hidden",
              ...reveal(0.2),
            }}
          >
            <div
              style={{
                padding: "11px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 5 }}>
                {["#f87171", "#fbbf24", "#4ade80"].map((c, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.38 }} />
                ))}
              </div>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.textMic, marginLeft: 6 }}>
                app/api/checkout/route.ts
              </span>
            </div>
            <div style={{ padding: "14px 0", overflowX: "auto" }}>
              {lines.map((line) => (
                <div
                  key={line.n}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "2.5px 18px",
                    background: line.hl ? "rgba(105,191,255,0.055)" : "transparent",
                    borderLeft: line.hl ? "2px solid rgba(105,191,255,0.6)" : "2px solid transparent",
                  }}
                >
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      color: C.muted,
                      width: 28,
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    {line.n}
                  </span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      color: line.hl ? C.text2 : C.text3,
                      lineHeight: "22px",
                      whiteSpace: "pre",
                    }}
                  >
                    {line.code}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ paddingTop: 16, ...reveal(0.4) }}>
            <div
              style={{
                padding: "20px",
                background: "rgba(105,191,255,0.04)",
                border: "1px solid rgba(105,191,255,0.13)",
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: C.blue,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Investigation links here
              </div>
              <p style={{ fontFamily: sans, fontSize: 14, lineHeight: 1.68, color: C.text2, margin: "0 0 16px" }}>
                Line 89 corresponds to the database query with elevated latency. The trace spans for this call show a
                2.4s execution time — 8× above baseline.
              </p>
              {[
                { k: "Function",      v: "getUserOrders()" },
                { k: "Span duration", v: "2.4s ↑↑"         },
                { k: "Baseline",      v: "~290ms"          },
              ].map((row) => (
                <div key={row.k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.text3 }}>{row.k}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.text2 }}>{row.v}</span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.68, color: C.muted, fontStyle: "italic" }}>
              Halo links this source location to the evidence — it doesn&apos;t claim to have found the root cause, only
              to have followed the evidence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({ isAuthenticated }: { isAuthenticated?: boolean }) {
  const [ref, inView] = useInView(0.3);
  const reveal = (d = 0) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(16px)",
    transition: `opacity 0.65s ease ${d}s, transform 0.65s ease ${d}s`,
  });

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        padding: "160px 24px",
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Second-strongest atmospheric blue on the page */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "800px",
          height: "500px",
          background: [
            "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(105,191,255,0.1) 0%, rgba(43,143,217,0.04) 45%, transparent 70%)",
            "radial-gradient(ellipse 65% 60% at 50% 50%, rgba(13,59,97,0.18) 0%, transparent 68%)",
          ].join(", "),
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: "0.18em",
            color: C.textMic,
            textTransform: "uppercase",
            marginBottom: 24,
            ...reveal(0),
          }}
        >
          Ready to investigate
        </div>

        <h2
          style={{
            fontFamily: sans,
            fontSize: "clamp(36px, 5vw, 64px)",
            fontWeight: 600,
            color: C.textDisp,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            marginBottom: 20,
            ...reveal(0.1),
          }}
        >
          Stop guessing.
          <br />
          Start investigating.
        </h2>

        <p
          style={{
            fontFamily: sans,
            fontSize: 18,
            lineHeight: 1.72,
            color: C.text3,
            maxWidth: 400,
            margin: "0 auto 48px",
            ...reveal(0.22),
          }}
        >
          See what your telemetry actually tells you.
        </p>

        <div style={reveal(0.38)}>
          <Link
            href={isAuthenticated ? "/overview" : "/sign-up"}
            style={{
              display: "inline-block",
              fontFamily: sans,
              fontSize: 15,
              fontWeight: 600,
              padding: "14px 36px",
              borderRadius: 8,
              background: C.blue,
              color: C.bg,
              textDecoration: "none",
              transition: "background 0.2s ease, transform 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.blueBr;
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = C.blue;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {isAuthenticated ? "Open Dashboard" : "Get started"}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {/* Full wordmark in footer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/halo-wordmark.png"
          alt="Halo"
          style={{ height: 32, width: "auto", mixBlendMode: "screen", objectFit: "contain", opacity: 0.7 }}
        />
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {[
            { label: "Product", href: "#evidence" },
            { label: "Docs", href: "/sdk" },
            { label: "Pricing", href: "/pricing" },
            { label: "Privacy", href: "/settings/privacy" },
            { label: "Terms", href: "/settings/legal" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                fontFamily: sans,
                fontSize: 13,
                color: C.muted,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text3)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function LandingPage({ isAuthenticated = false }: LandingPageProps) {
  return (
    <div style={{ background: C.bg, minHeight: "100%", fontFamily: sans, color: C.textDisp }}>
      <Nav isAuthenticated={isAuthenticated} />
      <Hero isAuthenticated={isAuthenticated} />
      <BigIdea />
      <Telemetry />
      <EvidenceGraph />
      <Trust />
      <Source />
      <FinalCTA isAuthenticated={isAuthenticated} />
      <Footer />
    </div>
  );
}
