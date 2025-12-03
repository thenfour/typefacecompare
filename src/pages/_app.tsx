import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SiteHeader } from "@/components/Layout/SiteHeader";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="app-shell">
      <SiteHeader />
      <div className="app-content">
        <Component {...pageProps} />
      </div>
    </div>
  );
}
