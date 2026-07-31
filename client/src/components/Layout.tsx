import type { ReactNode } from "react";
import StatusBar from "./StatusBar.js";
import InstallPwaButton from "./InstallPwaButton.js";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <StatusBar />
      <div className="flex-1 min-h-0">{children}</div>
      <InstallPwaButton />
    </div>
  );
}
