import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Turbopack walks upward looking for a lockfile to infer the workspace root.
 * There is one in the user's home directory, so it would otherwise treat the
 * whole home folder as the project — it declines, and warns.
 *
 * Pinning the root to this file's own directory fixes it without hardcoding
 * anyone's absolute path, so the repository stays portable.
 */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: projectRoot,
  },
  /**
   * The dev route indicator renders into `<nextjs-portal>` at the bottom-left
   * of the viewport. The browser suite drives the phone against a dev server,
   * and the phone's own tab bar sits in exactly that corner — so on the 375px
   * mobile project the indicator sat on top of it and swallowed every click.
   *
   * CI found this on its first run: ten tests failed there, all of them
   * clicking a phone tab, with Playwright reporting the portal "intercepts
   * pointer events". They passed locally, because a dev server that has been
   * running a while has usually had the indicator dismissed.
   *
   * Turning it off is not hiding a problem: per the Next docs, compile and
   * runtime errors are still surfaced with this set to false. It removes a
   * piece of development chrome that had no business being clickable in a
   * test run.
   */
  devIndicators: false,
};

export default nextConfig;
