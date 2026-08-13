"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { htmlLangFromPathname } from "@/lib/html-lang";

export function HtmlLang() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = htmlLangFromPathname(pathname);
  }, [pathname]);

  return null;
}
