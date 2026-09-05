"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  BookOpen,
  Terminal,
  Activity,
  ShieldAlert,
  FileCode,
  Check,
  Copy,
  ChevronRight,
  Menu,
  X,
  Layers,
  CornerDownLeft,
} from "lucide-react";
import { SEARCH_DOC_INDEX, SearchDocItem } from "./search-index";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const sans = "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const mono = "var(--font-geist-mono), 'SF Mono', 'Fira Code', Menlo, Consolas, monospace";

const C = {
  bg: "#02060A",
  bgSubtle: "#050B14",
  panel: "#06101A",
  panelElevated: "#091726",
  border: "rgba(105, 191, 255, 0.09)",
  borderActive: "rgba(105, 191, 255, 0.32)",
  blue: "#69BFFF",
  blueGlow: "rgba(105, 191, 255, 0.12)",
  textPrimary: "#F0F5FA",
  textHeadingSec: "#C5D4E3",
  textBody: "#8E9CAD",
  textMuted: "#657487",
  textMeta: "#465466",
  codeBg: "#030810",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
};

// ─── Docs Navigation Structure ─────────────────────────────────────────────────
interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  items: { id: string; title: string; desc?: string }[];
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: BookOpen,
    items: [
      { id: "overview", title: "Overview", desc: "The Halo philosophy and investigative architecture" },
      { id: "quickstart", title: "Quickstart", desc: "Integrate Halo in under 3 minutes" },
      { id: "architecture", title: "Architecture", desc: "How telemetry flows from services to evidence" },
    ],
  },
  {
    id: "logs-and-telemetry",
    title: "Logs & Telemetry",
    icon: Terminal,
    items: [
      { id: "logs-ingestion", title: "Ingestion Model", desc: "High-throughput batching and event pipeline" },
      { id: "logs-structured", title: "Structured Logging", desc: "Format, log levels, and custom JSON payloads" },
      { id: "logs-traces", title: "Spans & Distributed Tracing", desc: "Trace propagation across microservice boundaries" },
      { id: "logs-breadcrumbs", title: "Breadcrumbs & Context", desc: "Capture user and network actions leading to failures" },
    ],
  },
  {
    id: "investigations",
    title: "Investigations Engine",
    icon: Activity,
    items: [
      { id: "investigations-how", title: "How Halo Investigates", desc: "Automated root-cause discovery vs raw alerting" },
      { id: "investigations-causal-chain", title: "Causal Chain Reconstruction", desc: "Tracing error provenance across distributed dependencies" },
      { id: "investigations-evidence-graph", title: "Evidence Graph & Scoring", desc: "Confidence metrics, confirmed facts, and validation" },
      { id: "investigations-gaps", title: "Unknowns & Evidence Gaps", desc: "Explicitly surfacing uncaptured telemetry and blindspots" },
    ],
  },
  {
    id: "features",
    title: "Platform Features",
    icon: Layers,
    items: [
      { id: "features-replay", title: "Session Replay", desc: "DOM mutation recording with pre-error circular buffer" },
      { id: "features-source", title: "Source Investigation", desc: "Git repository mapping, commit blame, and stack frames" },
      { id: "features-monitors", title: "Monitors & Alerts", desc: "Metric thresholds, error budgets, and SLO tracking" },
      { id: "features-autofix", title: "Autofix Engine", desc: "Automated PR patch generation based on proven root causes" },
    ],
  },
  {
    id: "sdk-reference",
    title: "SDK & API Reference",
    icon: FileCode,
    items: [
      { id: "sdk-setup", title: "Installation & Setup", desc: "Client instantiation and configuration options" },
      { id: "sdk-capture", title: "Capture API", desc: "Manual error, message, and trace capture methods" },
      { id: "sdk-middleware", title: "HTTP & Framework Middleware", desc: "Express, Next.js, and Node.js automatic hooks" },
    ],
  },
];

// ─── Interactive Code Snippet Component ────────────────────────────────────────
function CodeBlock({
  code,
  language = "typescript",
  filename,
}: {
  code: string;
  language?: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.codeBg,
        overflow: "hidden",
        margin: "18px 0",
        maxWidth: "100%",
      }}
    >
      {filename && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            borderBottom: `1px solid ${C.border}`,
            background: "rgba(6, 16, 26, 0.6)",
            fontFamily: mono,
            fontSize: 12,
            color: C.textMuted,
          }}
        >
          <span>{filename}</span>
          <span style={{ fontSize: 11, color: C.textMeta, textTransform: "uppercase" }}>{language}</span>
        </div>
      )}

      <pre
        style={{
          margin: 0,
          padding: "16px 20px",
          fontFamily: mono,
          fontSize: 13,
          lineHeight: 1.65,
          color: "#D2DFEC",
          maxWidth: "100%",
          overflowX: "auto",
          whiteSpace: "pre",
        }}
      >
        <code>{code.trim()}</code>
      </pre>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        style={{
          position: "absolute",
          top: filename ? 38 : 10,
          right: 10,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          borderRadius: 6,
          background: "rgba(9, 23, 38, 0.8)",
          border: `1px solid ${C.border}`,
          color: copied ? C.success : C.textBody,
          fontFamily: mono,
          fontSize: 11,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          transition: "all 0.16s ease",
        }}
      >
        {copied ? (
          <>
            <Check size={12} />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy size={12} />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

// ─── Callout Badge Component ───────────────────────────────────────────────────
function Callout({
  type = "note",
  title,
  children,
}: {
  type?: "note" | "tip" | "important" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  const configs = {
    note: { border: C.borderActive, bg: "rgba(105, 191, 255, 0.05)", iconColor: C.blue, label: "NOTE" },
    tip: { border: "rgba(52, 211, 153, 0.35)", bg: "rgba(52, 211, 153, 0.05)", iconColor: C.success, label: "PRO TIP" },
    important: { border: "rgba(105, 191, 255, 0.45)", bg: "rgba(105, 191, 255, 0.08)", iconColor: C.blue, label: "IMPORTANT" },
    warning: { border: "rgba(251, 191, 36, 0.4)", bg: "rgba(251, 191, 36, 0.05)", iconColor: C.warning, label: "CAUTION" },
  };

  const conf = configs[type];

  return (
    <div
      style={{
        margin: "20px 0",
        padding: "16px 20px",
        borderRadius: 10,
        background: conf.bg,
        borderLeft: `3px solid ${conf.iconColor}`,
        borderTop: `1px solid ${conf.border}`,
        borderRight: `1px solid ${conf.border}`,
        borderBottom: `1px solid ${conf.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: mono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: conf.iconColor,
          }}
        >
          {title || conf.label}
        </span>
      </div>
      <div style={{ fontFamily: sans, fontSize: 13.5, lineHeight: 1.6, color: C.textBody }}>{children}</div>
    </div>
  );
}

// ─── Main Docs Client Component ────────────────────────────────────────────────
export function DocsClient() {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Full-content search engine across all documentation guides, code, and features
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches: {
      id: string;
      category: string;
      title: string;
      before?: string;
      match?: string;
      after?: string;
      score: number;
    }[] = [];

    for (const doc of SEARCH_DOC_INDEX) {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      const summaryLower = doc.summary.toLowerCase();

      const titleIdx = titleLower.indexOf(q);
      const keywordMatch = doc.keywords.some((k) => k.toLowerCase().includes(q));
      const contentIdx = contentLower.indexOf(q);
      const summaryIdx = summaryLower.indexOf(q);

      if (titleIdx !== -1) score += 100;
      if (keywordMatch) score += 60;
      if (contentIdx !== -1) score += 40;
      if (summaryIdx !== -1) score += 20;

      if (score > 0) {
        let before = "";
        let match = "";
        let after = "";

        if (contentIdx !== -1) {
          const start = Math.max(0, contentIdx - 35);
          const end = Math.min(doc.content.length, contentIdx + q.length + 55);
          before = (start > 0 ? "..." : "") + doc.content.substring(start, contentIdx);
          match = doc.content.substring(contentIdx, contentIdx + q.length);
          after = doc.content.substring(contentIdx + q.length, end) + (end < doc.content.length ? "..." : "");
        } else {
          before = doc.summary.slice(0, 90) + "...";
        }

        matches.push({
          id: doc.id,
          category: doc.category,
          title: doc.title,
          before,
          match,
          after,
          score,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [searchQuery]);

  // Keep selected index in bounds when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults.length]);

  // Global keyboard shortcut Cmd+K or Ctrl+K to open search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered sections for sidebar navigation
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return DOC_SECTIONS;
    const q = searchQuery.toLowerCase();
    return DOC_SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter(
        (item) => item.title.toLowerCase().includes(q) || (item.desc && item.desc.toLowerCase().includes(q))
      ),
    })).filter((sec) => sec.items.length > 0);
  }, [searchQuery]);

  // Scroll spy to update active section
  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll("section[id]");
      const scrollPos = window.scrollY + 140;

      for (let i = headings.length - 1; i >= 0; i--) {
        const h = headings[i] as HTMLElement;
        if (h.offsetTop <= scrollPos) {
          setActiveSection(h.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const target = document.getElementById(id);
    if (target) {
      const topOffset = 90;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - topOffset;
      window.scrollTo({ top: targetPosition, behavior: "smooth" });
    }
  };

  const handleSelectResult = (id: string) => {
    scrollTo(id);
    setSearchOpen(false);
    // Visually pulse target section on the page so user sees what was found
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("halo-section-highlight");
      void el.offsetWidth; // trigger reflow
      el.classList.add("halo-section-highlight");
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = searchResults[selectedIndex];
      if (sel) {
        handleSelectResult(sel.id);
      }
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.textPrimary, fontFamily: sans, width: "100%", overflowX: "clip" }}>
      {/* ─── Sticky Technical Header ────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(2, 6, 10, 0.88)",
          backdropFilter: "blur(18px)",
          borderBottom: `1px solid ${C.border}`,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(16px, 3vw, 40px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            type="button"
            className="halo-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/halo-wordmark.png"
              alt="Halo"
              style={{
                height: 28,
                width: "auto",
                mixBlendMode: "screen",
                objectFit: "contain",
              }}
            />
            <span
              style={{
                fontFamily: mono,
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 4,
                background: "rgba(105, 191, 255, 0.08)",
                border: `1px solid ${C.border}`,
                color: C.blue,
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              DOCS
            </span>
          </Link>
        </div>

        {/* Center Search Input with Live In-Page Search Results */}
        <div
          ref={searchContainerRef}
          className="hidden sm:block"
          style={{
            position: "relative",
            maxWidth: 440,
            width: "100%",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: C.textMuted,
            }}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search documentation, features, APIs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            style={{
              width: "100%",
              height: 36,
              paddingLeft: 34,
              paddingRight: 48,
              borderRadius: 8,
              background: "rgba(6, 16, 26, 0.7)",
              border: `1px solid ${searchOpen && searchResults.length > 0 ? C.borderActive : C.border}`,
              color: C.textPrimary,
              fontSize: 13,
              fontFamily: sans,
              outline: "none",
              transition: "border-color 0.16s ease",
            }}
          />

          {/* Cmd+K Badge */}
          <div
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: mono,
              fontSize: 10,
              padding: "2px 5px",
              borderRadius: 4,
              background: "rgba(255, 255, 255, 0.06)",
              color: C.textMuted,
              border: `1px solid ${C.border}`,
              pointerEvents: "none",
            }}
          >
            ⌘K
          </div>

          {/* Floating Search Results Dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div
              style={{
                position: "absolute",
                top: 42,
                left: 0,
                right: 0,
                maxHeight: 440,
                overflowY: "auto",
                borderRadius: 10,
                background: "#040B13",
                border: `1px solid ${C.borderActive}`,
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(105, 191, 255, 0.08)",
                zIndex: 60,
                padding: "8px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 14px 8px",
                  borderBottom: `1px solid ${C.border}`,
                  fontFamily: mono,
                  fontSize: 11,
                  color: C.textMeta,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                <span>
                  {searchResults.length} {searchResults.length === 1 ? "match" : "matches"} found in page
                </span>
                <span style={{ fontSize: 10 }}>Press Esc to close</span>
              </div>

              {searchResults.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                  No documentation found matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                searchResults.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectResult(item.id)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        background: isSelected ? "rgba(105, 191, 255, 0.09)" : "transparent",
                        border: "none",
                        borderLeft: `2px solid ${isSelected ? C.blue : "transparent"}`,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        transition: "background 0.1s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span
                          style={{
                            fontFamily: sans,
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: isSelected ? C.textPrimary : C.textHeadingSec,
                          }}
                        >
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontFamily: mono,
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "rgba(105, 191, 255, 0.08)",
                            color: C.blue,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.category}
                        </span>
                      </div>

                      {item.match ? (
                        <div
                          style={{
                            fontFamily: mono,
                            fontSize: 11.5,
                            color: C.textBody,
                            lineHeight: 1.45,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.before}
                          <mark
                            style={{
                              background: "rgba(105, 191, 255, 0.22)",
                              color: "#8BD3FF",
                              borderRadius: 2,
                              padding: "0 2px",
                              fontWeight: 600,
                            }}
                          >
                            {item.match}
                          </mark>
                          {item.after}
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 12,
                            color: C.textMuted,
                            lineHeight: 1.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.before}
                        </div>
                      )}
                    </button>
                  );
                })
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 14px 4px",
                  borderTop: `1px solid ${C.border}`,
                  marginTop: 4,
                  fontFamily: mono,
                  fontSize: 10,
                  color: C.textMuted,
                }}
              >
                <span>↑↓ Navigate</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <CornerDownLeft size={10} /> Jump to section
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right CTA Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/pricing"
            className="hidden sm:inline-block"
            style={{
              fontFamily: sans,
              fontSize: 13,
              color: C.textBody,
              textDecoration: "none",
              padding: "6px 12px",
              transition: "color 0.16s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textBody)}
          >
            Pricing
          </Link>

          <Link
            href="/sign-in"
            className="hidden sm:inline-block"
            style={{
              fontFamily: sans,
              fontSize: 13,
              color: C.textBody,
              textDecoration: "none",
              padding: "6px 12px",
              transition: "color 0.16s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textBody)}
          >
            Log in
          </Link>

          <Link
            href="/sign-up"
            className="halo-primary-cta"
            style={{ height: 36, padding: "0 16px", fontSize: 13 }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* ─── Documentation Shell (Sidebar + Content + TOC) ─────────────────── */}
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          minHeight: "calc(100vh - 64px)",
          position: "relative",
        }}
      >
        {/* Left Sidebar (Desktop) */}
        <aside
          className="hidden md:block"
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: `1px solid ${C.border}`,
            padding: "24px 16px 40px",
            position: "sticky",
            top: 64,
            height: "calc(100vh - 64px)",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {filteredSections.map((section) => (
              <div key={section.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 8px 8px",
                    fontFamily: mono,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    color: C.textMeta,
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <section.icon size={13} style={{ color: C.blue }} />
                    {section.title}
                  </span>
                  {section.badge && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: "rgba(105, 191, 255, 0.1)",
                        color: C.blue,
                      }}
                    >
                      {section.badge}
                    </span>
                  )}
                </div>

                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {section.items.map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => scrollTo(item.id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "7px 10px",
                            borderRadius: 6,
                            fontFamily: sans,
                            fontSize: 13,
                            color: isActive ? C.textPrimary : C.textBody,
                            background: isActive ? "rgba(105, 191, 255, 0.08)" : "transparent",
                            border: `1px solid ${isActive ? "rgba(105, 191, 255, 0.18)" : "transparent"}`,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.title}</span>
                          {isActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.blue }} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="md:hidden"
            style={{
              position: "fixed",
              top: 64,
              left: 0,
              right: 0,
              bottom: 0,
              background: "#02060A",
              zIndex: 49,
              padding: "20px 20px 40px",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", gap: 16, paddingBottom: 16, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontFamily: sans, fontSize: 14, color: C.textHeadingSec, textDecoration: "none" }}
              >
                Pricing
              </Link>
              <span style={{ color: C.textMeta }}>·</span>
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontFamily: sans, fontSize: 14, color: C.textHeadingSec, textDecoration: "none" }}
              >
                Log in
              </Link>
            </div>

            <div style={{ marginBottom: 20 }}>
              <input
                placeholder="Search entire page & knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 8,
                  background: C.panel,
                  border: `1px solid ${searchResults.length > 0 ? C.borderActive : C.border}`,
                  color: C.textPrimary,
                  fontSize: 14,
                  outline: "none",
                }}
              />

              {/* Mobile search results dropdown */}
              {searchQuery.trim() && (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 8,
                    background: C.panel,
                    border: `1px solid ${C.borderActive}`,
                    padding: "6px 0",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 12px",
                      fontFamily: mono,
                      fontSize: 10,
                      color: C.textMeta,
                      textTransform: "uppercase",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {searchResults.length} {searchResults.length === 1 ? "match" : "matches"} found in page
                  </div>

                  {searchResults.length === 0 ? (
                    <div style={{ padding: "12px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                      No matches found
                    </div>
                  ) : (
                    searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectResult(item.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          background: "transparent",
                          border: "none",
                          borderBottom: `1px solid rgba(255,255,255,0.03)`,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary }}>{item.title}</span>
                          <span style={{ fontSize: 10, fontFamily: mono, color: C.blue }}>{item.category}</span>
                        </div>
                        {item.match ? (
                          <div style={{ fontSize: 11, fontFamily: mono, color: C.textBody, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.before}
                            <span style={{ color: "#8BD3FF", fontWeight: 700 }}>{item.match}</span>
                            {item.after}
                          </div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {filteredSections.map((section) => (
                <div key={section.id}>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      color: C.blue,
                      marginBottom: 8,
                      textTransform: "uppercase",
                    }}
                  >
                    {section.title}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollTo(item.id)}
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          borderRadius: 6,
                          fontSize: 14,
                          color: activeSection === item.id ? C.textPrimary : C.textBody,
                          background: activeSection === item.id ? "rgba(105, 191, 255, 0.1)" : "transparent",
                          border: "none",
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Main Content Canvas ────────────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "clamp(24px, 4vw, 56px) clamp(20px, 4vw, 64px)",
            maxWidth: 880,
          }}
        >
          {/* Breadcrumb Eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.14em",
              color: C.textMeta,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            <span>HALO DOCUMENTATION</span>
            <ChevronRight size={12} />
            <span style={{ color: C.blue }}>KNOWLEDGE BASE</span>
          </div>

          <h1
            style={{
              fontFamily: sans,
              fontSize: "clamp(32px, 3.4vw, 44px)",
              fontWeight: 700,
              lineHeight: 1.15,
              color: C.textPrimary,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            Halo Documentation
          </h1>

          <p
            style={{
              fontFamily: sans,
              fontSize: 17,
              lineHeight: 1.65,
              color: C.textBody,
              marginBottom: 44,
              maxWidth: 720,
            }}
          >
            Learn how Halo transforms distributed production telemetry into evidence-backed investigations —
            diagnosing root causes, verifying hypotheses, and eliminating guesswork across modern distributed systems.
          </p>

          <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, marginBottom: 48 }} />

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION: GETTING STARTED
          ═══════════════════════════════════════════════════════════════════════ */}
          <section id="overview" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.blue, letterSpacing: "0.12em" }}>01 · FOUNDATION</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Overview
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 18 }}>
              Traditional observability tools deluge engineering teams with raw logs, disconnected dashboards, and alert storms.
              When an outage strikes, engineers spend 80% of their time correlating timestamps and hypothesizing what occurred.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 18 }}>
              <strong>Halo operates on an evidence-first paradigm:</strong> every error, trace, and metric is treated as evidentiary data.
              Halo’s automated investigation engine links signals together into an immutable <em>Causal Chain</em>, computes confidence scores,
              and isolates the exact source code commit and database query responsible.
            </p>

            <Callout type="tip" title="EVIDENCE INTEGRITY">
              Unlike black-box AI tools that hallucinate explanations, Halo separates <strong>verified evidence</strong> from{" "}
              <strong>unknowns</strong> (e.g. uncaptured request bodies or disabled database logs), ensuring zero false confidence.
            </Callout>
          </section>

          <section id="quickstart" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Quickstart
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Install the official Halo SDK into your Node.js or TypeScript application in one command:
            </p>

            <CodeBlock code="pnpm add @halo-trace/sdk" language="bash" filename="Terminal" />

            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, margin: "20px 0 12px" }}>
              Initialize Halo at the entry point of your service (e.g. <code>server.ts</code> or <code>instrumentation.ts</code>):
            </p>

            <CodeBlock
              filename="src/server.ts"
              language="typescript"
              code={`import { Halo } from "@halo-trace/sdk";

// Initialize Halo telemetry client
const halo = new Halo({
  apiKey: process.env.HALO_API_KEY,
  service: "checkout-api",
  environment: "production",
  release: "v2.14.0",
});

// Capture any unexpected runtime fault
try {
  await processPayment(payload);
} catch (error) {
  await halo.captureError(error, {
    tags: { tenantId: "tenant_992", paymentMethod: "stripe" },
    metadata: { orderTotal: 189.50 },
  });
  throw error;
}`}
            />
          </section>

          <section id="architecture" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Architecture
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 18 }}>
              Halo’s pipeline is divided into three asynchronous layers to ensure near-zero overhead on customer production applications:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, margin: "20px 0" }}>
              <div style={{ padding: 18, borderRadius: 10, background: C.panel, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.blue, marginBottom: 8 }}>LAYER 1</div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>In-Process Queue</h4>
                <p style={{ fontSize: 13, color: C.textBody, lineHeight: 1.6, margin: 0 }}>
                  Non-blocking ring buffer that flushes batches over HTTP/2 without adding latency to customer request threads.
                </p>
              </div>

              <div style={{ padding: 18, borderRadius: 10, background: C.panel, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.blue, marginBottom: 8 }}>LAYER 2</div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Ingestion & Normalizer</h4>
                <p style={{ fontSize: 13, color: C.textBody, lineHeight: 1.6, margin: 0 }}>
                  High-throughput stream parser extracting stack frames, SQL fingerprints, distributed trace IDs, and breadcrumbs.
                </p>
              </div>

              <div style={{ padding: 18, borderRadius: 10, background: C.panel, border: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.blue, marginBottom: 8 }}>LAYER 3</div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Investigation Engine</h4>
                <p style={{ fontSize: 13, color: C.textBody, lineHeight: 1.6, margin: 0 }}>
                  Causal graph builder reconstructing state progressions, correlating anomalies, and synthesizing root cause reports.
                </p>
              </div>
            </div>
          </section>

          <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "48px 0" }} />

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION: LOGS & TELEMETRY
          ═══════════════════════════════════════════════════════════════════════ */}
          <section id="logs-ingestion" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.blue, letterSpacing: "0.12em" }}>02 · TELEMETRY PIPELINE</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Ingestion Model
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Halo ingests events via a low-latency HTTP endpoint (<code>/api/ingest/events</code>). The client automatically batches events
              every 250ms or when 50 items accumulate, preventing burst contention.
            </p>

            <CodeBlock
              filename="Payload Structure (POST /api/ingest/events)"
              language="json"
              code={`{
  "events": [
    {
      "type": "ERROR",
      "title": "NullPointerException: Cannot read properties of undefined",
      "message": "User checkout session expired prior to payment dispatch",
      "timestamp": "2026-09-05T23:42:10.840Z",
      "service": "checkout-api",
      "release": "v2.14.0",
      "severity": "ERROR",
      "traceId": "a3f87c2e4d1a9b7c",
      "tags": {
        "endpoint": "/api/checkout",
        "region": "us-east-1"
      },
      "stack": "NullPointerException\\n  at UserService.process (/app/src/user.ts:89:14)"
    }
  ]
}`}
            />
          </section>

          <section id="logs-structured" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Structured Logging
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              You can log structured information with arbitrary typed metadata. Halo automatically indexes parameters, allowing fast query
              searches and correlation with concurrent trace trees.
            </p>

            <CodeBlock
              filename="Structured Message Capture"
              language="typescript"
              code={`await halo.captureMessage("Payment retry sequence initiated", {
  severity: "WARNING",
  metadata: {
    attempt: 3,
    maxRetries: 5,
    gatewayResponseCode: 504,
    latencyMs: 3410,
  },
  tags: {
    gateway: "stripe-emea",
    customerTier: "enterprise",
  },
});`}
            />
          </section>

          <section id="logs-traces" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Spans & Distributed Tracing
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Halo tracks distributed spans across HTTP client calls and downstream database queries. Incoming requests automatically inherit
              the <code>halo-trace-id</code> header or W3C <code>traceparent</code>.
            </p>

            <CodeBlock
              filename="Tracing with Request Context"
              language="typescript"
              code={`import { Halo } from "@halo-trace/sdk";

// Wrap an asynchronous execution context
await halo.withRequestContext(
  {
    traceId: req.headers["x-trace-id"] || halo.generateId(),
    operation: "POST /checkout",
    resource: "orders-table",
  },
  async () => {
    // Any nested halo.captureError or halo.captureMessage automatically inherits this trace context
    await runCheckoutTransaction();
  }
);`}
            />
          </section>

          <section id="logs-breadcrumbs" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Breadcrumbs & Context
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Breadcrumbs capture the sequence of events preceding a fault. The Halo SDK automatically records outbound fetch calls,
              database client calls, and navigation transitions into a rolling buffer of the last 100 items.
            </p>

            <CodeBlock
              filename="Manual Breadcrumbs"
              language="typescript"
              code={`halo.addBreadcrumb({
  category: "auth",
  message: "JWT token validation succeeded for user_8471",
  level: "INFO",
  data: { scope: ["read:orders", "write:orders"], expiresAt: 1788640000 },
});

halo.addBreadcrumb({
  category: "database",
  message: "SELECT * FROM orders WHERE id = $1",
  level: "INFO",
  data: { durationMs: 42, rowsReturned: 1 },
});`}
            />
          </section>

          <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "48px 0" }} />

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION: INVESTIGATIONS ENGINE
          ═══════════════════════════════════════════════════════════════════════ */}
          <section id="investigations-how" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.blue, letterSpacing: "0.12em" }}>03 · INVESTIGATION PARADIGM</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              How Halo Investigates
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 18 }}>
              When an alert fires in conventional tools, an on-call engineer receives an incident with zero context.
              In Halo, firing events immediately spawn an <strong>Investigation</strong>:
            </p>

            <ul style={{ paddingLeft: 20, color: C.textBody, fontSize: 14.5, lineHeight: 1.7, marginBottom: 24 }}>
              <li><strong>Telemetry Correlator:</strong> Pulls trace trees, database queries, and session replays happening within ±120s of the incident.</li>
              <li><strong>Causal Chain Builder:</strong> Traverses upstream caller links to identify the originating root trigger.</li>
              <li><strong>Source Resolver:</strong> Maps minified production stack frames to exact Git commit SHAs, line numbers, and author blame.</li>
              <li><strong>Hypothesis Ranker:</strong> Scores potential failure causes by mathematical evidence weight.</li>
            </ul>

            <Callout type="important" title="EVIDENCE ARTIFACT">
              Each investigation generates a persistent Investigation Artifact containing the evidence timeline, linked sources,
              confidence score, and verified knowns/unknowns.
            </Callout>
          </section>

          <section id="investigations-causal-chain" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Causal Chain Reconstruction
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 18 }}>
              Instead of showing isolated errors, Halo builds a step-by-step state transition graph showing:
            </p>

            <div style={{ padding: 20, borderRadius: 10, background: C.panel, border: `1px solid ${C.border}`, fontFamily: mono, fontSize: 12 }}>
              <div style={{ color: C.error, marginBottom: 6 }}>● ERROR: NullPointerException at UserService.java:247</div>
              <div style={{ color: C.textMuted, marginLeft: 16, marginBottom: 6 }}>↑ caused by</div>
              <div style={{ color: C.blue, marginLeft: 16, marginBottom: 6 }}>● REQUEST: POST /api/checkout (trace_id: a3f87c2e)</div>
              <div style={{ color: C.textMuted, marginLeft: 32, marginBottom: 6 }}>↑ depends on</div>
              <div style={{ color: C.blue, marginLeft: 32, marginBottom: 6 }}>● TRACE: checkout.handler (duration: 1.847s)</div>
              <div style={{ color: C.textMuted, marginLeft: 48, marginBottom: 6 }}>↑ blocked by</div>
              <div style={{ color: C.warning, marginLeft: 48, marginBottom: 6 }}>● DATABASE: SELECT * FROM orders WHERE user_id = ? (latency 2.4s ↑↑ 94th pct)</div>
              <div style={{ color: C.textMuted, marginLeft: 64, marginBottom: 6 }}>↑ origin commit</div>
              <div style={{ color: C.textPrimary, marginLeft: 64 }}>● SOURCE: app/api/checkout/route.ts (line 89 · getUserOrders)</div>
            </div>
          </section>

          <section id="investigations-evidence-graph" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Evidence Graph & Scoring
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 18 }}>
              Halo calculates an objective <strong>Confidence Score</strong> (0.0 to 1.0) based on three mathematical criteria:
            </p>
            <ol style={{ paddingLeft: 20, color: C.textBody, fontSize: 14.5, lineHeight: 1.7, marginBottom: 20 }}>
              <li><strong>Temporal Proximity:</strong> Did the database latency spike occur strictly before the downstream timeout exception?</li>
              <li><strong>Trace Propagation:</strong> Did the trace ID flow directly from the HTTP gateway to the worker?</li>
              <li><strong>Fingerprint Match:</strong> Does the stack frame map to code changed in the most recent service deployment?</li>
            </ol>
          </section>

          <section id="investigations-gaps" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Unknowns & Evidence Gaps
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 18 }}>
              When a system fails due to uninstrumented third-party APIs or scrubbed payload bodies, Halo does not guess.
              It explicitly highlights <strong>Evidence Gaps</strong>:
            </p>

            <div
              style={{
                padding: "14px 18px",
                borderRadius: 8,
                background: "rgba(248, 113, 113, 0.06)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
                fontFamily: mono,
                fontSize: 12,
                color: "#FCA5A5",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>UNKNOWN: Request payload body was not captured (Sanitization Rule #4 applied).</span>
            </div>
          </section>

          <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "48px 0" }} />

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION: PLATFORM FEATURES
          ═══════════════════════════════════════════════════════════════════════ */}
          <section id="features-replay" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.blue, letterSpacing: "0.12em" }}>04 · CAPABILITIES</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Session Replay
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              The <code>@halo-trace/replay</code> client records browser DOM mutations, clicks, and network requests into an in-memory
              circular buffer (up to 60 seconds). If no error occurs, the recording is discarded, preserving bandwidth and privacy.
              When an error strikes, the buffer is dispatched and linked directly to the Investigation.
            </p>

            <CodeBlock
              filename="Client Browser Initialization"
              language="typescript"
              code={`import { initReplay } from "@halo-trace/replay";

initReplay({
  apiKey: "hl_live_...",
  projectId: "proj_checkout",
  preErrorBufferSeconds: 60,
  maskAllInputs: true,
  blockClasses: ["halo-hide", "sensitive-card-data"],
});`}
            />
          </section>

          <section id="features-source" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Source Investigation & Git Context
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Connect your GitHub or GitLab repositories under Project Settings. Halo automatically retrieves the corresponding commit
              source tree whenever a stack trace is reported.
            </p>
            <ul style={{ paddingLeft: 20, color: C.textBody, fontSize: 14.5, lineHeight: 1.7 }}>
              <li><strong>Zero developer machine paths:</strong> Sanitizes local absolute paths into verified repository relative paths.</li>
              <li><strong>Inline syntax view:</strong> Inspect lines ±15 around the throwing expression without leaving the dashboard.</li>
              <li><strong>Commit & PR blame:</strong> Identifies which pull request introduced the breaking change.</li>
            </ul>
          </section>

          <section id="features-monitors" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Monitors & Anomaly Detection
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Set proactive alerts across custom queries, error spikes, or SLO burn rates.
            </p>
            <CodeBlock
              filename="Supported Monitor Types"
              language="typescript"
              code={`// Example: Alert if checkout failure rate > 2% over 5m window
{
  name: "High Checkout Failure Rate",
  type: "ERROR_RATE",
  thresholdValue: 2.0, // percent
  thresholdWindow: 5,   // minutes
  query: "service:checkout-api AND status:ERROR",
  alertConfig: {
    channels: ["SLACK_WEBHOOK", "PAGERDUTY", "EMAIL"],
    autoSpawnInvestigation: true
  }
}`}
            />
          </section>

          <section id="features-autofix" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Autofix Engine
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Once an Investigation establishes high confidence (&gt; 0.85) in the root cause, Halo can draft a pull-request-ready code patch.
              The patch addresses the missing null check, unhandled promise, or invalid database query and includes a regression test.
            </p>
          </section>

          <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "48px 0" }} />

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION: SDK REFERENCE
          ═══════════════════════════════════════════════════════════════════════ */}
          <section id="sdk-setup" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.blue, letterSpacing: "0.12em" }}>05 · DEVELOPER INTERFACE</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              SDK Installation & Setup
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              The <code>@halo-trace/sdk</code> library is available on npm and yarn:
            </p>

            <CodeBlock code="pnpm add @halo-trace/sdk" language="bash" />

            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.textHeadingSec, margin: "28px 0 12px" }}>
              Constructor Options
            </h3>

            <div style={{ overflowX: "auto", margin: "16px 0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left", fontFamily: sans }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMeta, fontFamily: mono, fontSize: 11 }}>
                    <th style={{ padding: "10px 12px" }}>OPTION</th>
                    <th style={{ padding: "10px 12px" }}>TYPE</th>
                    <th style={{ padding: "10px 12px" }}>REQUIRED</th>
                    <th style={{ padding: "10px 12px" }}>DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody style={{ color: C.textBody }}>
                  <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "10px 12px", fontFamily: mono, color: C.blue }}>apiKey</td>
                    <td style={{ padding: "10px 12px", fontFamily: mono }}>string</td>
                    <td style={{ padding: "10px 12px", color: C.success }}>Yes</td>
                    <td style={{ padding: "10px 12px" }}>Live ingestion key starting with <code>hl_live_...</code></td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "10px 12px", fontFamily: mono, color: C.blue }}>service</td>
                    <td style={{ padding: "10px 12px", fontFamily: mono }}>string</td>
                    <td style={{ padding: "10px 12px", color: C.textMuted }}>Optional</td>
                    <td style={{ padding: "10px 12px" }}>Service identifier (e.g. <code>api-gateway</code>)</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "10px 12px", fontFamily: mono, color: C.blue }}>environment</td>
                    <td style={{ padding: "10px 12px", fontFamily: mono }}>string</td>
                    <td style={{ padding: "10px 12px", color: C.textMuted }}>Optional</td>
                    <td style={{ padding: "10px 12px" }}>Default <code>production</code> or <code>staging</code></td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "10px 12px", fontFamily: mono, color: C.blue }}>release</td>
                    <td style={{ padding: "10px 12px", fontFamily: mono }}>string</td>
                    <td style={{ padding: "10px 12px", color: C.textMuted }}>Optional</td>
                    <td style={{ padding: "10px 12px" }}>Semver string or Git commit SHA</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="sdk-capture" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              Capture API
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Halo provides explicit capture APIs for catching exceptions and recording custom business events:
            </p>

            <CodeBlock
              filename="Manual Capture Methods"
              language="typescript"
              code={`// 1. Capture Error
await halo.captureError(new Error("Database connection pool exhausted"), {
  severity: "FATAL",
  tags: { dbHost: "db-primary.internal" },
});

// 2. Capture Message
await halo.captureMessage("Worker queue scaling threshold reached", {
  severity: "WARNING",
  metadata: { activeJobs: 450, workers: 8 },
});

// 3. User Identity Linking
halo.setUser({
  id: "usr_99812",
  email: "alex@enterprise.com",
  username: "alex_dev",
});`}
            />
          </section>

          <section id="sdk-middleware" style={{ scrollMarginTop: 90, marginBottom: 80 }}>
            <h2 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.02em", marginBottom: 16 }}>
              HTTP & Framework Middleware
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textBody, marginBottom: 16 }}>
              Plug Halo into your Express or Next.js server to automatically instrument incoming requests, catch unhandled rejections,
              and bind distributed trace headers:
            </p>

            <CodeBlock
              filename="Express Middleware Integration"
              language="typescript"
              code={`import express from "express";
import { Halo } from "@halo-trace/sdk";

const app = express();
const halo = new Halo({ apiKey: process.env.HALO_API_KEY });

// 1. Request handler (must be first middleware)
app.use((req, res, next) => {
  halo.withRequestContext(
    {
      traceId: req.headers["x-trace-id"] || halo.generateId(),
      operation: \`\${req.method} \${req.path}\`,
    },
    next
  );
});

// Normal routes...
app.get("/api/data", (req, res) => {
  res.json({ status: "ok" });
});

// 2. Error handler (must be before any other error middleware)
app.use((err, req, res, next) => {
  halo.captureError(err, {
    metadata: { path: req.path, query: req.query },
  });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(3000);`}
            />
          </section>

          {/* ─── Footer Jump Bar ────────────────────────────────────────────── */}
          <div
            style={{
              padding: "32px 28px",
              borderRadius: 12,
              background: C.panel,
              border: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div>
              <h4 style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, margin: "0 0 4px" }}>
                Ready to investigate production issues?
              </h4>
              <p style={{ fontSize: 13, color: C.textBody, margin: 0 }}>
                Set up Halo in under 3 minutes with generous free tier limits.
              </p>
            </div>

            <Link href="/sign-up" className="halo-primary-cta" style={{ height: 42, padding: "0 22px", fontSize: 14 }}>
              Get started free
            </Link>
          </div>
        </main>

        {/* ─── Right Sidebar: On This Page Table of Contents (Desktop) ─────── */}
        <aside
          className="hidden xl:block"
          style={{
            width: 240,
            flexShrink: 0,
            padding: "32px 16px 40px",
            position: "sticky",
            top: 64,
            height: "calc(100vh - 64px)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.12em",
              color: C.textMeta,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            ON THIS PAGE
          </div>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {DOC_SECTIONS.flatMap((s) => s.items).map((item) => {
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(item.id)}
                    style={{
                      textAlign: "left",
                      fontFamily: sans,
                      fontSize: 12.5,
                      color: isActive ? C.blue : C.textMuted,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 0",
                      lineHeight: 1.4,
                      transition: "color 0.16s ease",
                      display: "block",
                      width: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = C.textHeadingSec;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = C.textMuted;
                    }}
                  >
                    {item.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
