"use client";

import { useEffect, useState } from "react";

const links = [
  { href: "/learn", label: "Learn" },
  { href: "/prompts", label: "Prompts" },
  { href: "/docs", label: "Docs" },
  { href: "https://github.com/drewsephski/promptmarket", label: "GitHub" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(
    function lockScrollWhileOpen() {
      if (!open) {
        return;
      }
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }

      window.addEventListener("keydown", handleKeyDown);
      return function cleanup() {
        document.body.style.overflow = previous;
        window.removeEventListener("keydown", handleKeyDown);
      };
    },
    [open],
  );

  function handleToggle() {
    setOpen(function toggle(current) {
      return !current;
    });
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <header className={open ? "mast is-open" : "mast"}>
      <div className="island">
        <a className="brand" href="/" onClick={handleClose}>
          <span className="brand-mark" aria-hidden="true" />
          PromptMarket
        </a>
        <nav className="nav-inline" aria-label="Primary">
          {links.map(function renderLink(link) {
            return (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          className={open ? "menu-toggle is-open" : "menu-toggle"}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={handleToggle}
        >
          <span />
          <span />
        </button>
      </div>
      <div
        id="site-menu"
        className={open ? "overlay is-open" : "overlay"}
        aria-hidden={open ? undefined : true}
      >
        <p className="eyebrow overlay-kicker">Index</p>
        <nav className="overlay-links" aria-label="Mobile">
          <a href="/" onClick={handleClose}>
            Home
          </a>
          {links.map(function renderOverlayLink(link) {
            return (
              <a key={link.href} href={link.href} onClick={handleClose}>
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <p>Learn the pattern. Grab the prompt. Build.</p>
      <span className="footer-links">
        <a href="/learn">Learn</a>
        <a href="/prompts">Prompts</a>
        <a href="/recipes">Skills</a>
        <a href="/docs">Docs</a>
      </span>
    </footer>
  );
}
