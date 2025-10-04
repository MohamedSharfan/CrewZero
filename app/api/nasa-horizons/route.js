// app/api/nasa-horizons/route.js

export async function GET(request) {
  try {
    // Extract query string (after '?')
    const { searchParams } = new URL(request.url);
    const search = searchParams.toString();

    // Construct full NASA Horizons URL
    const nasaUrl = `https://ssd.jpl.nasa.gov/api/horizons.api?${search}`;

    // Fetch data from NASA (server side, no CORS issue)
    const response = await fetch(nasaUrl);
    const text = await response.text(); // Horizons sometimes returns plain text even if format=json

    // Return the raw response
    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("NASA Horizons proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch from NASA Horizons" }),
      { status: 500 }
    );
  }
}
