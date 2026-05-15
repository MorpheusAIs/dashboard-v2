"use client";

import { useEffect } from "react";

type UmamiPayload = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (name: string, params?: Record<string, unknown>) => void;
    };
  }
}

const MAX_VALUE_LENGTH = 120;

function clean(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, MAX_VALUE_LENGTH);
}

function getText(element: Element): string | undefined {
  return clean(
    element.getAttribute("data-analytics-label") ||
      element.getAttribute("data-umami-event") ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent,
  );
}

function getArea(element: Element): string {
  const area = element.closest("header, nav, main, footer, aside, section, form");
  return area?.tagName.toLowerCase() || "body";
}

function getPageSection(): string {
  const section = window.location.pathname.split("/").filter(Boolean)[0];
  return section || "home";
}

function getDestination(anchor: HTMLAnchorElement): { destination: string; outbound: boolean } {
  const url = new URL(anchor.href, window.location.href);
  const outbound = url.origin !== window.location.origin;

  return {
    destination: outbound
      ? `${url.origin}${url.pathname}${url.search}${url.hash}`
      : `${url.pathname}${url.search}${url.hash}`,
    outbound,
  };
}

function track(name: string, payload: UmamiPayload): void {
  window.umami?.track(name, {
    current_path: window.location.pathname,
    page_title: document.title,
    page_section: getPageSection(),
    ...payload,
  });
}

export function UmamiInteractionTracker(): null {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");

      if (anchor) {
        const { destination, outbound } = getDestination(anchor);

        track(outbound ? "link-click-external" : "link-click-internal", {
          link_text: getText(anchor) || "unlabeled link",
          destination,
          link_domain: new URL(anchor.href, window.location.href).hostname,
          element_area: getArea(anchor),
        });

        return;
      }

      const action = target.closest<HTMLElement>(
        "button, [role='button'], [data-umami-action], [data-analytics-action]",
      );

      if (!action) {
        return;
      }

      track("button-click", {
        button_text: getText(action) || "unlabeled button",
        action_name:
          clean(action.getAttribute("data-analytics-action")) ||
          clean(action.getAttribute("data-umami-action")) ||
          "click",
        element_area: getArea(action),
      });
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form) {
        return;
      }

      track("form-submit", {
        form_name:
          clean(form.getAttribute("name")) ||
          clean(form.id) ||
          clean(form.getAttribute("aria-label")) ||
          "unlabeled form",
        element_area: getArea(form),
      });
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
