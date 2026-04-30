const DEFAULT_URL = "https://mydoccy.com/?utm_source=offline&utm_medium=business_card";

function normalizeHeaderLocation(location, fromUrl) {
  try {
    return new URL(location, fromUrl).toString();
  } catch {
    return null;
  }
}

function extractParams(urlString) {
  const url = new URL(urlString);
  return {
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
  };
}

async function followRedirectChain(startUrl, maxHops = 10) {
  const chain = [];
  let current = startUrl;

  for (let i = 0; i < maxHops; i += 1) {
    const res = await fetch(current, { method: "GET", redirect: "manual" });
    const status = res.status;
    const locationHeader = res.headers.get("location");
    const next =
      locationHeader && status >= 300 && status < 400
        ? normalizeHeaderLocation(locationHeader, current)
        : null;

    chain.push({
      url: current,
      status,
      location: next,
    });

    if (!next) break;
    current = next;
  }

  return chain;
}

async function main() {
  const startUrl = (process.argv[2] || DEFAULT_URL).trim();
  if (!startUrl) {
    console.error("Missing URL.");
    process.exit(1);
  }

  const initialParams = extractParams(startUrl);
  const chain = await followRedirectChain(startUrl);
  const last = chain[chain.length - 1];
  const finalUrl = last?.url || startUrl;
  const finalParams = extractParams(finalUrl);

  console.log(`Start URL: ${startUrl}`);
  console.log("Redirect chain:");
  chain.forEach((step, idx) => {
    console.log(`${idx + 1}. [${step.status}] ${step.url}`);
    if (step.location) {
      console.log(`   -> ${step.location}`);
    }
  });

  const preserved =
    finalParams.utm_source === initialParams.utm_source &&
    finalParams.utm_medium === initialParams.utm_medium;

  console.log("");
  console.log(`Final URL: ${finalUrl}`);
  console.log(`Initial UTM: source=${initialParams.utm_source}, medium=${initialParams.utm_medium}`);
  console.log(`Final UTM:   source=${finalParams.utm_source}, medium=${finalParams.utm_medium}`);
  console.log(`UTM preserved: ${preserved ? "YES" : "NO"}`);

  if (!preserved) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("Redirect/UTM check failed:", error);
  process.exit(1);
});
