export function isCloudflareChallengePage(title: string, html: string): boolean {
  return (
    /just a moment|attention required|checking your browser/i.test(title) ||
    /cf-browser-verification|cdn-cgi\/challenge-platform|cf-challenge-running/i.test(html)
  );
}
