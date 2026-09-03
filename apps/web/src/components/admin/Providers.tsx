"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { ToastProvider } from "@/components/ui/Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
