"use client";

import * as React from "react";

type RegisterDevErrorConsoleProps = {
  errorCode: string;
  errorDetail: string;
};

export function RegisterDevErrorConsole({
  errorCode,
  errorDetail,
}: RegisterDevErrorConsoleProps) {
  React.useEffect(() => {
    // Dev-only diagnostics for manual registration debugging.
    console.error("[DocCy:Register][DEV]", {
      errorCode,
      errorDetail,
    });
  }, [errorCode, errorDetail]);

  return null;
}

