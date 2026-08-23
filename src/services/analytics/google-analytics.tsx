import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { getPublicEnv } from "@/config/env";
import { configureAnalytics, type AnalyticsProvider } from "@/services/analytics";
import {
  CONSENT_CHANGED_EVENT,
  hasAnalyticsConsent,
  type ConsentPreferences,
} from "@/services/analytics/consent";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

let loadedMeasurementId: string | null = null;

function googleAnalyticsProvider(): AnalyticsProvider {
  return {
    track(event, properties) {
      window.gtag?.("event", event, properties);
    },
  };
}

function enableGoogleAnalytics(measurementId: string) {
  window[`ga-disable-${measurementId}`] = false;
  if (!window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("js", new Date());
  }
  window.gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    send_page_view: false,
  });
  configureAnalytics(googleAnalyticsProvider());

  if (loadedMeasurementId === measurementId) return;
  loadedMeasurementId = measurementId;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.vidrialAnalytics = measurementId;
  document.head.appendChild(script);
}

function disableGoogleAnalytics(measurementId: string) {
  window[`ga-disable-${measurementId}`] = true;
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  configureAnalytics(null);
}

export function GoogleAnalytics() {
  const location = useLocation();
  const measurementId = getPublicEnv().VITE_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!measurementId) return;

    const applyConsent = (consent?: ConsentPreferences | null) => {
      const allowed = consent?.analytics ?? hasAnalyticsConsent(window.localStorage);
      if (allowed) enableGoogleAnalytics(measurementId);
      else disableGoogleAnalytics(measurementId);
    };
    const handleConsent = (event: Event) => {
      applyConsent((event as CustomEvent<ConsentPreferences>).detail);
    };

    applyConsent();
    window.addEventListener(CONSENT_CHANGED_EVENT, handleConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handleConsent);
  }, [measurementId]);

  useEffect(() => {
    if (!measurementId || !hasAnalyticsConsent(window.localStorage)) return;
    enableGoogleAnalytics(measurementId);
    window.gtag?.("event", "page_view", {
      page_location: window.location.href,
      page_path: `${location.pathname}${location.searchStr}`,
      page_title: document.title,
    });
  }, [location.pathname, location.searchStr, measurementId]);

  return null;
}
