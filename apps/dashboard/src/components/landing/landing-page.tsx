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

// ─── Design Tokens (Strict Brand & Typography Hierarchy) ─────────────────────

const C = {
  bg: "#02060A",             // Base background, dominant page background
  blueBlack: "#06101A",      // Deep blue-black
  atmBlue: "#081827",        // Secondary atmospheric blue
  blue: "#69BFFF",           // Primary Halo sky blue
  blueBr: "#8BD3FF",         // Bright sky blue
  surface: "#080C11",        // Card surface
  surfaceElevated: "#090D12",
  codeBg: "#070A0F",         // Code panel background
  surfaceSubtle: "rgba(255,255,255,0.02)",
  textPrimary: "#E7EDF4",    // Primary text / major headlines
  textBigIdeaMuted: "#8E9CAD",// Big Idea first line / section secondary
  textHeadingSec: "#C9D2DE", // Secondary headings
  textSectionSub: "#8E9CAD", // Section secondary line
  textBody: "#9AA7B7",       // Body text / supporting copy
  textMuted: "#657487",      // Muted text
  textMeta: "#596779",       // Technical metadata
  textMetaFaint: "#465364",  // Very faint metadata
  // Borders
  border: "rgba(255,255,255,0.06)",
  borderElevated: "rgba(255,255,255,0.08)",
  borderBlue: "rgba(105,191,255,0.18)",
  borderDashed: "rgba(255,255,255,0.10)",
  // Semantic data indicators
  red: "#f87171",            // Error
  yellow: "#fbbf24",         // Database
};

const mono = "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace";
const sans = "var(--font-geist-sans), 'Geist', system-ui, -apple-system, sans-serif";

interface LandingPageProps {
  isAuthenticated?: boolean;
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function Nav({ isAuthenticated }: { isAuthenticated?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const navLinks = [
    { label: "Product", href: "#evidence" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Docs", href: "/sdk" },
    { label: "Pricing", href: "/pricing" },
  ];

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
        background: scrolled || mobileMenuOpen ? "rgba(2,6,10,0.88)" : "transparent",
        backdropFilter: scrolled || mobileMenuOpen ? "blur(14px)" : "none",
        borderBottom: scrolled || mobileMenuOpen ? `1px solid ${C.border}` : "1px solid transparent",
        transition: "background 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease",
      }}
    >
      <div
        className="landing-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "100%",
        }}
      >
        {/* Left: Halo logo wordmark */}
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/halo-wordmark.png"
            alt="Halo"
            style={{
              height: 34,
              width: "auto",
              mixBlendMode: "screen",
              objectFit: "contain",
            }}
          />
        </Link>

        {/* Center: Navigation (desktop) */}
        <div className="hidden md:flex" style={{ gap: 32, alignItems: "center" }}>
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                fontFamily: sans,
                fontSize: 14,
                color: C.textMuted,
                textDecoration: "none",
                transition: "color 0.16s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.textHeadingSec)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right: Auth / Action Area */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/sign-in"
            className="hidden sm:inline-block"
            style={{
              fontFamily: sans,
              fontSize: 14,
              color: C.textMuted,
              padding: "8px 14px",
              textDecoration: "none",
              transition: "color 0.16s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.textHeadingSec)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="halo-primary-cta"
            style={{ height: 40, padding: "0 18px", fontSize: 13 }}
          >
            Get started
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="halo-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          className="md:hidden"
          style={{
            position: "absolute",
            top: 72,
            left: 0,
            right: 0,
            background: "rgba(4,6,10,0.97)",
            backdropFilter: "blur(18px)",
            borderBottom: `1px solid ${C.border}`,
            padding: "20px 24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            zIndex: 49,
          }}
        >
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontFamily: sans,
                fontSize: 16,
                color: C.textHeadingSec,
                textDecoration: "none",
                padding: "8px 0",
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/sign-in"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              fontFamily: sans,
              fontSize: 16,
              color: C.textMuted,
              textDecoration: "none",
              padding: "8px 0",
            }}
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            onClick={() => setMobileMenuOpen(false)}
            className="halo-primary-cta"
            style={{ height: 40, padding: "0 18px", fontSize: 14, marginTop: 4 }}
          >
            Get started
          </Link>
        </div>
      )}
    </nav>
  );
}

// ─── Hero Investigation Artifact ─────────────────────────────────────────────

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
        gap: 14,
        paddingLeft: indent ? 28 : 0,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: visible ? dot : "transparent",
            flexShrink: 0,
            marginTop: 4,
            boxShadow: visible ? `0 0 8px ${dot}55` : "none",
            transition: "background 0.3s ease, box-shadow 0.3s ease",
          }}
        />
        {!isLast && (
          <div
            style={{
              position: "relative",
              width: 1,
              flexGrow: 1,
              minHeight: 28,
              background: "linear-gradient(to bottom, rgba(105,191,255,0.24), rgba(105,191,255,0.06))",
              transform: lineVisible ? "scaleY(1)" : "scaleY(0)",
              transformOrigin: "top center",
              transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: isLast ? 6 : 20, flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: "0.14em",
            color: C.textMeta,
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div style={{ fontFamily: sans, fontSize: 13, color: C.textHeadingSec, fontWeight: 500, lineHeight: 1.4 }}>
          {title}
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.textMuted, marginTop: 2, wordBreak: "break-all" }}>
          {meta}
        </div>
      </div>
    </div>
  );
}

function HeroArtifact() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Staggered reveal sequence
    const delays = [200, 550, 900, 1250, 1600, 1950, 2350];
    const timers = delays.map((d, i) => setTimeout(() => setStep(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, []);

  const v = (n: number) => step >= n;

  return (
    <div
      className="anim-hero-artifact halo-card-hover"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 660,
        marginLeft: "auto",
        background: C.surface,
        border: `1px solid ${C.borderElevated}`,
        borderRadius: 16,
        boxShadow: "0 28px 72px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.02)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.16em",
              color: C.textMeta,
              textTransform: "uppercase",
            }}
          >
            INVESTIGATION
          </span>
          <span style={{ fontFamily: mono, fontSize: 11, color: C.textMuted }}>#7743a</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.blue,
              opacity: v(1) ? 0.95 : 0,
              boxShadow: v(1) ? `0 0 8px ${C.blue}80` : "none",
              transition: "opacity 0.4s ease",
            }}
          />
          <span
            style={{
              fontFamily: mono,
              fontSize: 10,
              letterSpacing: "0.14em",
              color: C.textMeta,
              textTransform: "uppercase",
            }}
          >
            ACTIVE
          </span>
        </div>
      </div>

      {/* Nodes list */}
      <div style={{ padding: "22px 24px 6px" }}>
        <ENode
          visible={v(1)}
          lineVisible={v(2)}
          label="ERROR"
          title="NullPointerException"
          meta="UserService.java:247 · checkout.process()"
          dot={C.red}
        />
        <ENode
          visible={v(2)}
          lineVisible={v(3)}
          label="REQUEST"
          title="POST /api/checkout"
          meta="trace_id: a3f87c2e4d1a · 1 min ago"
          dot={C.blue}
        />
        <ENode
          visible={v(3)}
          lineVisible={v(4)}
          label="TRACE"
          title="checkout.handler"
          meta="span_id: 7c2e · duration: 1.847s"
          dot={C.blue}
        />
        <ENode
          visible={v(4)}
          lineVisible={false}
          label="DATABASE"
          title="SELECT * FROM orders WHERE user_id = ?"
          meta="latency: 2.4s ↑↑ · 94th pct spike"
          dot={C.yellow}
          indent
        />
        <ENode
          visible={v(5)}
          lineVisible={false}
          label="SOURCE"
          title="app/api/checkout/route.ts"
          meta="line 89 · getUserOrders(session.user.id)"
          dot={C.blue}
          isLast
        />
      </div>

      {/* Bottom Summary */}
      <div
        style={{
          margin: "8px 24px 22px",
          padding: "14px 18px",
          background: "rgba(105,191,255,0.03)",
          border: `1px solid ${C.borderBlue}`,
          borderRadius: 10,
          opacity: v(6) ? 1 : 0,
          transform: v(6) ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  color: C.textMeta,
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                CONFIDENCE
              </div>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.blue }}>High</div>
            </div>
            <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.07)" }} />
            <div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  color: C.textMeta,
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                SOURCES
              </div>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 500, color: C.textHeadingSec }}>4 linked</div>
            </div>
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 10,
              color: C.textMuted,
              textAlign: "right",
              lineHeight: 1.45,
            }}
          >
            REQUEST BODY<br />NOT CAPTURED
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
        minHeight: "min(100vh, 860px)",
        display: "flex",
        alignItems: "center",
        paddingTop: "clamp(96px, 13vh, 144px)",
        paddingBottom: "clamp(64px, 10vh, 108px)",
        position: "relative",
      }}
    >
      <div className="landing-container">
        {/* Golden-ratio inspired fluid composition: minmax(0, 0.92fr) / minmax(0, 1.08fr) */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-10 lg:gap-12 xl:gap-16 2xl:gap-20 items-center">
          {/* Left: Copy & Actions */}
          <div className="w-full">
            <div
              className="anim-hero-eyebrow"
              style={{
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.16em",
                color: C.textMeta,
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              OBSERVE · CONNECT · INVESTIGATE
            </div>

            <h1
              className="anim-hero-headline"
              style={{
                fontFamily: sans,
                fontSize: "clamp(40px, 4.8vw, 72px)",
                lineHeight: 1.0,
                fontWeight: 600,
                color: C.textPrimary,
                marginBottom: 24,
                maxWidth: 640,
                letterSpacing: "-0.035em",
              }}
            >
              Understand what<br />actually broke.
            </h1>

            <p
              className="anim-hero-body"
              style={{
                fontFamily: sans,
                fontSize: "clamp(16px, 1.2vw, 18px)",
                lineHeight: 1.65,
                color: C.textBody,
                marginBottom: 40,
                maxWidth: 560,
              }}
            >
              Halo turns production telemetry into evidence-backed investigations — showing what happened, what the
              evidence supports, and what remains unknown.
            </p>

            <div
              className="anim-hero-actions"
              style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}
            >
              <Link
                href="/sign-up"
                className="halo-primary-cta"
              >
                Get started
              </Link>
              <a
                href="#evidence"
                className="halo-secondary-action"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right: Investigation Artifact */}
          <div className="w-full flex justify-end">
            <HeroArtifact />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 2 — Big Idea ────────────────────────────────────────────────────

function BigIdea() {
  const [ref, inView] = useInView(0.25);

  return (
    <section
      ref={ref}
      style={{
        padding: "clamp(120px, 16vh, 180px) 0",
        position: "relative",
        textAlign: "center",
      }}
    >
      <div className="landing-container" style={{ position: "relative" }}>
        <div
          style={{
            width: 32,
            height: 1,
            background: "rgba(105,191,255,0.22)",
            margin: "0 auto 48px",
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        />

        <p
          style={{
            fontFamily: sans,
            fontSize: "clamp(28px, 3.6vw, 46px)",
            lineHeight: 1.35,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            maxWidth: 880,
            margin: "0 auto",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s",
          }}
        >
          <span style={{ color: C.textBigIdeaMuted }}>Observability gives you data.</span>
          <br />
          <span style={{ color: C.textPrimary, fontWeight: 500 }}>Investigation gives it meaning.</span>
        </p>

        <div
          style={{
            width: 32,
            height: 1,
            background: "rgba(105,191,255,0.22)",
            margin: "48px auto 0",
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s ease 0.3s",
          }}
        />
      </div>
    </section>
  );
}

// ─── Section 3 — Telemetry → Investigation Choreography ──────────────────────

function Telemetry() {
  const [ref, inView] = useInView(0.18);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // Sequential choreography: heading -> rows -> halo connector -> card -> traveling signal -> stop
    const timers = [
      setTimeout(() => setPhase(1), 80),   // heading
      setTimeout(() => setPhase(2), 240),  // rows
      setTimeout(() => setPhase(3), 720),  // halo connector
      setTimeout(() => setPhase(4), 1050), // investigation card
      setTimeout(() => setPhase(5), 1400), // single signal travels
      setTimeout(() => setPhase(6), 2200), // sequence complete, still
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const raw = [
    { label: "LOGS",     val: "2.4M/min" },
    { label: "REQUESTS", val: "847/s"    },
    { label: "ERRORS",   val: "0.31%"    },
    { label: "TRACES",   val: "12K/s"    },
    { label: "METRICS",  val: "340/host" },
    { label: "DATABASE", val: "4.2K qps" },
  ];

  return (
    <section
      ref={ref}
      style={{
        padding: "clamp(120px, 15vh, 160px) 0",
        position: "relative",
      }}
    >
      <div className="landing-container" style={{ position: "relative" }}>
        <div style={{ marginBottom: 64 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMeta,
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: phase >= 1 ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}
          >
            FROM TELEMETRY TO EVIDENCE
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 48px)",
              fontWeight: 600,
              color: C.textPrimary,
              lineHeight: 1.12,
              letterSpacing: "-0.025em",
              maxWidth: 640,
              opacity: phase >= 1 ? 1 : 0,
              transform: phase >= 1 ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            Halo doesn&apos;t collect telemetry.
            <br />
            <span style={{ color: C.textSectionSub, fontWeight: 400 }}>It connects it.</span>
          </h2>
        </div>

        {/* Golden ratio guided layout: Raw inputs (~58%) -> Understated connector -> Investigation card (~42%) */}
        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_auto_1fr] gap-8 lg:gap-12 xl:gap-16 items-center">
          {/* Raw Telemetry */}
          <div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.16em",
                color: C.textMeta,
                textTransform: "uppercase",
                marginBottom: 18,
                opacity: phase >= 2 ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
            >
              RAW TELEMETRY
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {raw.map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.018)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    opacity: phase >= 2 ? 1 : 0,
                    transform: phase >= 2 ? "translateX(0)" : "translateX(-8px)",
                    transition: `opacity 0.45s ease ${i * 0.07}s, transform 0.45s ease ${i * 0.07}s`,
                  }}
                >
                  <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: C.textMuted }}>
                    {item.label}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.textMeta }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Understated HALO connector with single traveling pulse in phase 5 */}
          <div className="hidden md:flex" style={{ flexDirection: "column", alignItems: "center", gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={`top-${i}`}
                style={{
                  width: 1,
                  height: 6,
                  background: phase === 5 ? C.blue : `rgba(105,191,255,${0.12 + i * 0.06})`,
                  transition: "background 0.3s ease",
                }}
              />
            ))}
            <div
              style={{
                padding: "8px 16px",
                background: "rgba(105,191,255,0.04)",
                border: `1px solid ${phase === 5 ? "rgba(105,191,255,0.45)" : "rgba(105,191,255,0.22)"}`,
                borderRadius: 8,
                fontFamily: mono,
                fontSize: 11,
                letterSpacing: "0.18em",
                color: C.blue,
                textTransform: "uppercase",
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? "scale(1)" : "scale(0.95)",
                transition: "opacity 0.5s ease, transform 0.5s ease, border-color 0.3s ease",
              }}
            >
              HALO
            </div>
            {[...Array(4)].map((_, i) => (
              <div
                key={`bot-${i}`}
                style={{
                  width: 1,
                  height: 6,
                  background: phase === 5 ? C.blue : `rgba(105,191,255,${0.12 + (3 - i) * 0.06})`,
                  transition: "background 0.3s ease",
                }}
              />
            ))}
          </div>

          {/* Investigation Result Card */}
          <div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: "0.16em",
                color: C.textMeta,
                textTransform: "uppercase",
                marginBottom: 18,
                opacity: phase >= 4 ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
            >
              INVESTIGATION
            </div>
            <div
              className="halo-card-hover"
              style={{
                padding: "24px",
                background: C.surface,
                border: `1px solid ${C.borderBlue}`,
                borderRadius: 14,
                boxShadow: "0 20px 48px rgba(0,0,0,0.45)",
                opacity: phase >= 4 ? 1 : 0,
                transform: phase >= 4 ? "translateX(0)" : "translateX(8px)",
                transition: "opacity 0.55s ease, transform 0.55s ease",
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
                  color: C.textHeadingSec,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  marginBottom: 18,
                }}
              >
                Database latency spike during checkout
              </div>
              {[
                { k: "Confidence", v: "High",     vc: C.blue },
                { k: "Sources",    v: "4 linked",  vc: C.textHeadingSec },
                { k: "Unknown",    v: "1 gap",     vc: C.textMuted },
              ].map((row) => (
                <div
                  key={row.k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.textMuted }}>{row.k}</span>
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

// ─── Section 4 — Evidence Graph Choreography ──────────────────────────────────

function EvidenceGraph() {
  const [ref, inView] = useInView(0.2);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // Step-by-step evidence construction sequence
    const timers = [
      setTimeout(() => setStep(1), 150),  // Step 1: Error node appears
      setTimeout(() => setStep(2), 500),  // Step 2: Request line draws
      setTimeout(() => setStep(3), 850),  // Step 3: Trace line draws
      setTimeout(() => setStep(4), 1200), // Step 4: Source line draws
      setTimeout(() => setStep(5), 1550), // Step 5: Database line draws
      setTimeout(() => setStep(6), 1950), // Step 6: Nodes subtly illuminate
      setTimeout(() => setStep(7), 2300), // Step 7: Single signal travels along relationship
      setTimeout(() => setStep(8), 3100), // Finished: perfectly still
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const nodes = {
    error:    { id: "error",    x: 350, y: 56,  label: "ERROR",    dot: C.red,    minStep: 1 },
    request:  { id: "request",  x: 120, y: 180, label: "REQUEST",  dot: C.blue,   minStep: 2 },
    trace:    { id: "trace",    x: 350, y: 180, label: "TRACE",    dot: C.blue,   minStep: 3 },
    source:   { id: "source",   x: 580, y: 180, label: "SOURCE",   dot: C.blue,   minStep: 4 },
    database: { id: "database", x: 350, y: 296, label: "DATABASE", dot: C.yellow, minStep: 5 },
  };

  const edges = [
    { a: nodes.error, b: nodes.request,  stepTrigger: 2 },
    { a: nodes.error, b: nodes.trace,    stepTrigger: 3 },
    { a: nodes.error, b: nodes.source,   stepTrigger: 4 },
    { a: nodes.trace, b: nodes.database, stepTrigger: 5 },
  ];

  function len(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

  return (
    <section
      id="evidence"
      ref={ref}
      style={{
        padding: "clamp(120px, 16vh, 180px) 0",
        position: "relative",
      }}
    >
      <div className="landing-container" style={{ position: "relative" }}>
        <div style={{ marginBottom: 64 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMeta,
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: step >= 1 ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}
          >
            EVIDENCE RELATIONSHIPS
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 48px)",
              fontWeight: 600,
              color: C.textPrimary,
              lineHeight: 1.12,
              letterSpacing: "-0.025em",
              maxWidth: 640,
              opacity: step >= 1 ? 1 : 0,
              transform: step >= 1 ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            Every failure leaves a trail.
            <br />
            <span style={{ color: C.textSectionSub, fontWeight: 400 }}>Halo follows it.</span>
          </h2>
        </div>

        {/* Evidence Network SVG (NO causal arrows, neutral relationship lines) */}
        <div style={{ display: "flex", justifyContent: "center", width: "100%", overflowX: "auto" }}>
          <svg
            viewBox="0 0 700 360"
            style={{ overflow: "visible", width: "100%", maxWidth: 840, height: "auto" }}
          >
            {/* Subtle glow behind nodes */}
            {Object.values(nodes).map((n) => (
              <circle
                key={`glow-${n.label}`}
                cx={n.x}
                cy={n.y}
                r={hoveredNode === n.id ? 28 : 20}
                fill={n.dot}
                style={{
                  opacity: step >= n.minStep ? (hoveredNode === n.id ? 0.14 : (step >= 6 ? 0.06 : 0.03)) : 0,
                  transition: "opacity 0.4s ease, r 0.3s ease",
                  filter: "blur(6px)",
                }}
              />
            ))}

            {/* Neutral relationship lines */}
            {edges.map((e, i) => {
              const l = len(e.a, e.b);
              const isDrawn = step >= e.stepTrigger;
              const isHighlighted = hoveredNode === e.a.id || hoveredNode === e.b.id;
              return (
                <line
                  key={i}
                  x1={e.a.x}
                  y1={e.a.y}
                  x2={e.b.x}
                  y2={e.b.y}
                  stroke={isHighlighted ? "rgba(105,191,255,0.6)" : (step === 7 && i === 1 ? "rgba(105,191,255,0.55)" : "rgba(105,191,255,0.22)")}
                  strokeWidth="1"
                  style={{
                    strokeDasharray: l,
                    strokeDashoffset: isDrawn ? 0 : l,
                    transition: "stroke-dashoffset 0.65s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.25s ease",
                  }}
                />
              );
            })}

            {/* Nodes & Labels */}
            {Object.values(nodes).map((n) => {
              const isHovered = hoveredNode === n.id;
              const isVisible = step >= n.minStep;
              return (
                <g
                  key={n.label}
                  className="halo-evidence-node"
                  onMouseEnter={() => setHoveredNode(n.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isHovered ? 14 : 10}
                    fill={n.dot}
                    style={{
                      opacity: isVisible ? (isHovered ? 0.2 : (step >= 6 ? 0.1 : 0.07)) : 0,
                      transition: "opacity 0.4s ease, r 0.2s ease",
                    }}
                  />
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isHovered ? 5.5 : 4.5}
                    fill={n.dot}
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transition: "opacity 0.4s ease, r 0.2s ease",
                    }}
                  />
                  <text
                    x={n.x}
                    y={n.y - 18}
                    textAnchor="middle"
                    fill={isHovered ? C.textPrimary : C.textMeta}
                    fontSize="9.5"
                    fontFamily={mono}
                    letterSpacing="1.5"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transition: "opacity 0.45s ease, fill 0.2s ease",
                      userSelect: "none",
                    }}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p
          style={{
            fontFamily: sans,
            textAlign: "center",
            fontSize: 16,
            lineHeight: 1.72,
            color: C.textBody,
            maxWidth: 620,
            margin: "48px auto 0",
            opacity: step >= 6 ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          An error is not an event in isolation — it is a node in a network of evidence. Requests, traces, database
          calls, and source context are all connected.
        </p>
      </div>
    </section>
  );
}

// ─── Section 5 — Evidence Integrity ──────────────────────────────────────────

function Trust() {
  const [ref, inView] = useInView(0.18);

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
        padding: "clamp(120px, 15vh, 160px) 0",
        position: "relative",
      }}
    >
      <div className="landing-container" style={{ position: "relative" }}>
        <div style={{ maxWidth: 680, marginBottom: 64 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMeta,
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: inView ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}
          >
            EVIDENCE INTEGRITY
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 48px)",
              fontWeight: 600,
              lineHeight: 1.12,
              letterSpacing: "-0.025em",
              marginBottom: 20,
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s",
            }}
          >
            <span style={{ color: C.textPrimary }}>When the evidence isn&apos;t enough, </span>
            <span style={{ color: C.blue }}>Halo says so.</span>
          </h2>
          <p
            style={{
              fontFamily: sans,
              fontSize: 17,
              lineHeight: 1.68,
              color: C.textBody,
              opacity: inView ? 1 : 0,
              transition: "opacity 0.5s ease 0.25s",
            }}
          >
            Halo knows the difference between evidence and assumption. It doesn&apos;t fill gaps with guesses.
          </p>
        </div>

        {/* Evidence gaps list */}
        <div>
          {limits.map((item, i) => (
            <div
              key={item.label}
              className="grid grid-cols-1 sm:grid-cols-[minmax(240px,1fr)_2.5fr] gap-4 sm:gap-12 xl:gap-20 items-start"
              style={{
                padding: "26px 0",
                borderTop: `1px solid ${C.border}`,
                borderBottom: i === limits.length - 1 ? `1px solid ${C.border}` : "none",
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(10px)",
                transition: `opacity 0.45s ease ${0.25 + i * 0.09}s, transform 0.45s ease ${0.25 + i * 0.09}s`,
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    border: `1px dashed ${C.borderDashed}`,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.012)",
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.22)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      color: C.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
              <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.68, color: C.textBody, margin: "2px 0 0" }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <p
          style={{
            fontFamily: sans,
            marginTop: 56,
            fontSize: 16,
            lineHeight: 1.72,
            color: C.textMuted,
            maxWidth: 600,
            opacity: inView ? 1 : 0,
            transition: "opacity 0.5s ease 0.65s",
          }}
        >
          These are not failures. They are trust signals. An investigation that acknowledges what it doesn&apos;t know
          is more reliable than one that doesn&apos;t.
        </p>
      </div>
    </section>
  );
}

// ─── Section 6 — Source Investigation ─────────────────────────────────────────

function Source() {
  const [ref, inView] = useInView(0.18);

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

  return (
    <section
      ref={ref}
      style={{
        padding: "clamp(120px, 15vh, 160px) 0",
        position: "relative",
      }}
    >
      <div className="landing-container" style={{ position: "relative" }}>
        <div style={{ maxWidth: 580, marginBottom: 56 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              color: C.textMeta,
              textTransform: "uppercase",
              marginBottom: 14,
              opacity: inView ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}
          >
            SOURCE INVESTIGATION
          </div>
          <h2
            style={{
              fontFamily: sans,
              fontSize: "clamp(28px, 3.5vw, 48px)",
              fontWeight: 600,
              color: C.textPrimary,
              lineHeight: 1.12,
              letterSpacing: "-0.025em",
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s",
            }}
          >
            Follow the evidence
            <br />
            <span style={{ color: C.textSectionSub, fontWeight: 400 }}>to where it happened.</span>
          </h2>
        </div>

        {/* Code panel (~58%) and Investigation relationship panel (~42%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.38fr_1fr] gap-10 xl:gap-14 items-start">
          {/* Code Panel */}
          <div
            className="halo-source-panel"
            style={{
              background: C.codeBg,
              border: `1px solid ${C.borderElevated}`,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s, background-color 200ms ease, border-color 200ms ease",
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {["#f87171", "#fbbf24", "#4ade80"].map((c, i) => (
                  <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.35 }} />
                ))}
              </div>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.textMeta, marginLeft: 6 }}>
                app/api/checkout/route.ts
              </span>
            </div>
            {/* Internal horizontal scroll for code to prevent any page overflow */}
            <div style={{ padding: "16px 0", overflowX: "auto", width: "100%" }}>
              {lines.map((line) => (
                <div
                  key={line.n}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "3px 20px",
                    background: line.hl ? "rgba(105,191,255,0.07)" : "transparent",
                    borderLeft: line.hl ? "2px solid rgba(105,191,255,0.6)" : "2px solid transparent",
                  }}
                >
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      color: C.textMetaFaint,
                      width: 32,
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
                      color: line.hl ? C.textHeadingSec : C.textMuted,
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

          {/* Investigation explanation panel */}
          <div
            style={{
              paddingTop: 12,
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.35s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.35s",
            }}
          >
            <div
              className="halo-card-hover"
              style={{
                padding: "22px",
                background: C.surface,
                border: `1px solid ${C.borderBlue}`,
                borderRadius: 12,
                marginBottom: 18,
                boxShadow: "0 18px 44px rgba(0,0,0,0.45)",
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
                INVESTIGATION LINKS HERE
              </div>
              <p style={{ fontFamily: sans, fontSize: 14, lineHeight: 1.68, color: C.textBody, margin: "0 0 18px" }}>
                Line 89 corresponds to the database query with elevated latency. The trace spans for this call show a
                2.4s execution time — 8× above baseline.
              </p>
              {[
                { k: "Function",      v: "getUserOrders()" },
                { k: "Span duration", v: "2.4s ↑↑"         },
                { k: "Baseline",      v: "~290ms"          },
              ].map((row) => (
                <div key={row.k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.textMuted }}>{row.k}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.textHeadingSec }}>{row.v}</span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.68, color: C.textMeta, fontStyle: "italic" }}>
              Halo links this source location to the evidence — it doesn&apos;t claim to have found the root cause, only
              to have followed the evidence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 7 / Final CTA ────────────────────────────────────────────────────

function FinalCTA({ isAuthenticated }: { isAuthenticated?: boolean }) {
  const [ref, inView] = useInView(0.25);

  return (
    <section
      ref={ref}
      style={{
        padding: "clamp(140px, 18vh, 200px) 0",
        position: "relative",
        textAlign: "center",
      }}
    >
      <div className="landing-container" style={{ position: "relative" }}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: "0.18em",
            color: C.textMeta,
            textTransform: "uppercase",
            marginBottom: 22,
            opacity: inView ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        >
          READY TO INVESTIGATE
        </div>

        <h2
          style={{
            fontFamily: sans,
            fontSize: "clamp(36px, 5vw, 64px)",
            fontWeight: 600,
            color: C.textPrimary,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            marginBottom: 20,
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s",
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
            lineHeight: 1.65,
            color: C.textBody,
            maxWidth: 480,
            margin: "0 auto 44px",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s",
          }}
        >
          See what your telemetry actually tells you.
        </p>

        <div
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s",
          }}
        >
          <Link
            href="/sign-up"
            className="halo-primary-cta"
            style={{ height: 50, padding: "0 34px", fontSize: 15 }}
          >
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const footerLinks = [
    { label: "Product", href: "#evidence" },
    { label: "Docs", href: "/sdk" },
    { label: "Pricing", href: "/pricing" },
    { label: "Privacy", href: "/settings/privacy" },
    { label: "Terms", href: "/settings/legal" },
  ];

  return (
    <footer
      style={{
        borderTop: `1px solid ${C.border}`,
        padding: "44px 0",
        position: "relative",
      }}
    >
      <div
        className="landing-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        {/* Halo Wordmark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/halo-wordmark.png"
          alt="Halo"
          style={{
            height: 30,
            width: "auto",
            mixBlendMode: "screen",
            objectFit: "contain",
            opacity: 0.72,
          }}
        />

        {/* Links */}
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {footerLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{
                fontFamily: sans,
                fontSize: 13,
                color: C.textMeta,
                textDecoration: "none",
                transition: "color 0.16s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.textHeadingSec)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMeta)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Landing Page Root (Continuous Atmospheric Canvas Architecture) ───────────

export default function LandingPage({ isAuthenticated = false }: LandingPageProps) {
  // Centralized performant scroll handler for 1-3% atmospheric parallax
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          document.documentElement.style.setProperty("--halo-scroll", `${window.scrollY}px`);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        background: C.bg,
        color: C.textPrimary,
        fontFamily: sans,
        minHeight: "100vh",
        width: "100%",
        overflowX: "clip",
      }}
    >
      {/* ─── Global Contained Background Canvas (Zero Overflow Source) ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          width: "100%",
        }}
      >
        {/* Layer 1: Continuous Multi-stop Vertical Atmospheric Gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, #02060A 0%, #030810 12%, #06101A 28%, #081827 46%, #06101A 64%, #040B13 82%, #02060A 100%)",
          }}
        />

        {/* Layer 2: Subtle Static Technical Grid (rgba(105,191,255, 0.028) at 64px) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(105, 191, 255, 0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(105, 191, 255, 0.028) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 90% 95% at 50% 50%, black 40%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 95% at 50% 50%, black 40%, transparent 95%)",
          }}
        />

        {/* Layer 3: Scroll-Linked Parallax Atmosphere (1-3% movement) with 12s ambient breathing */}
        <div
          className="halo-atmosphere-canvas"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <div
            className="halo-atmosphere-layer"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {/* Layer A: Deep Blue Atmospheric Field */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "55%",
                background:
                  "radial-gradient(ellipse 70% 50% at 58% 30%, rgba(8, 24, 39, 0.55) 0%, rgba(6, 16, 26, 0.25) 45%, transparent 75%)",
                filter: "blur(24px)",
              }}
            />

            {/* Layer B: Subtle Sky-Blue Atmospheric Signal (Hero / Artifact focus) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                background:
                  "radial-gradient(ellipse 55% 40% at 56% 32%, rgba(105, 191, 255, 0.038) 0%, transparent 68%)",
                filter: "blur(20px)",
              }}
            />

            {/* Layer C: Lower-Page Atmospheric Depth (Middle / Lower page) */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "50%",
                background:
                  "radial-gradient(ellipse 70% 45% at 50% 75%, rgba(8, 24, 39, 0.45) 0%, rgba(6, 16, 26, 0.2) 50%, transparent 75%)",
                filter: "blur(24px)",
              }}
            />

            {/* Atmospheric Sky-Blue Convergence behind Final CTA */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "35%",
                background:
                  "radial-gradient(ellipse 50% 35% at 50% 85%, rgba(105, 191, 255, 0.045) 0%, transparent 65%)",
                filter: "blur(22px)",
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── Foreground Content ─── */}
      <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
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
    </div>
  );
}
