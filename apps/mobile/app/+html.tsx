/**
 * The HTML shell for the web build. **Web only** - expo-router uses this file
 * to render `index.html` at export time and never bundles it for native, so
 * anything here is free as far as the phone builds are concerned.
 *
 * It exists for one reason: to make the app installable. Everything below the
 * viewport tag is what iOS and Android look for before they will treat a page
 * as a home-screen app rather than a bookmark - the manifest, the touch icon,
 * and the startup images that stand in for a native splash screen.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';
import { APPLE_STARTUP_IMAGES } from '@/web/appleStartupImages';

/** The masthead teal. Tints the browser chrome around the page. */
const THEME = '#061E1B';
/** The cream the icon is drawn on - what shows before the first paint. */
const GROUND = '#F7F7EF';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/*
          `viewport-fit=cover` lets the masthead run under the notch the way it
          does on device; without it an installed web app letterboxes itself.
          Zoom is left enabled - pinch-to-zoom is an accessibility affordance,
          and the layouts already hold up under it.
        */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/*
          No <title> here on purpose. expo-router renders its own through
          react-helmet, and helmet's lands first in the head - which is the one
          the browser reads. The root layout sets it instead.
        */}
        <meta name="theme-color" content={THEME} />
        <meta name="description" content="Au service de votre mosquée." />
        <link rel="manifest" href="/manifest.json" />

        {/* iOS ignores the manifest for all of this and wants its own tags. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="M’Ensemble" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/*
          One tag per device. iOS matches on exact metrics and does not scale or
          fall back, so a device missing from this list boots to a blank white
          screen. Generated - see scripts/build-app-icons.js.
        */}
        {APPLE_STARTUP_IMAGES.map(({ media, href }) => (
          <link key={href} rel="apple-touch-startup-image" media={media} href={href} />
        ))}

        {/*
          Disables body scrolling on web, which makes ScrollViews behave the way
          they do natively. Remove it and the page gets a second scrollbar
          outside every screen's own.
        */}
        <ScrollViewStyleReset />

        {/*
          The ground behind the app, painted before React mounts so the first
          frame is not a white flash. Matches the splash and the icon.
        */}
        <style dangerouslySetInnerHTML={{ __html: BACKGROUND }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BACKGROUND = `
html, body { background-color: ${GROUND}; }
@media (prefers-color-scheme: dark) {
  /* The app is light-only by design (userInterfaceStyle in app.json), so this
     only keeps the browser from painting its own dark ground behind it. */
  html, body { background-color: ${GROUND}; }
}
`;
