
const API_HOST = "instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function isInstagramUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    return (
      parsed.protocol === "https:" &&
      (
        host === "instagram.com" ||
        host.endsWith(".instagram.com") ||
        host === "instagr.am" ||
        host.endsWith(".instagr.am")
      )
    );
  } catch {
    return false;
  }
}

function isAllowedMediaUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    return (
      parsed.protocol === "https:" &&
      (
        host.endsWith(".cdninstagram.com") ||
        host.endsWith(".fbcdn.net")
      )
    );
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/download") {
      if (request.method !== "GET") {
        return json({ error: "Method not allowed." }, 405);
      }

      const instagramUrl = url.searchParams.get("url");

      if (!instagramUrl || !isInstagramUrl(instagramUrl)) {
        return json({ error: "Please enter a valid Instagram link." }, 400);
      }

      if (!env.RAPIDAPI_KEY) {
        return json({ error: "The API key is not configured." }, 500);
      }

      try {
        const apiUrl = new URL(`https://${API_HOST}/convert`);
        apiUrl.searchParams.set("url", instagramUrl);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "x-rapidapi-host": API_HOST,
            "x-rapidapi-key": env.RAPIDAPI_KEY
          }
        });

        const data = await response.json();

        if (!response.ok) {
          return json({
            error: data.message || data.error || "Instagram download service failed."
          }, response.status);
        }

        if (!Array.isArray(data.media) || data.media.length === 0) {
          return json({ error: "No downloadable media was found." }, 404);
        }

        const media = data.media.filter(item =>
          item &&
          typeof item.url === "string" &&
          isAllowedMediaUrl(item.url)
        );

        if (media.length === 0) {
          return json({ error: "No valid media download links were returned." }, 404);
        }

        return json({ media });
      } catch (error) {
        return json({ error: "Unable to process the Instagram link. Please try again." }, 500);
      }
    }

    if (url.pathname === "/api/proxy-download") {
      const mediaUrl = url.searchParams.get("url");

      if (!mediaUrl || !isAllowedMediaUrl(mediaUrl)) {
        return json({ error: "Invalid media download URL." }, 400);
      }

      try {
        const response = await fetch(mediaUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });

        if (!response.ok) {
          return json({ error: "Unable to retrieve the media file." }, response.status);
        }

        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        const extension = contentType.includes("image") ? "jpg" : "mp4";
        const filename = `instasave_${Date.now()}.${extension}`;

        return new Response(response.body, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store"
          }
        });
      } catch {
        return json({ error: "Download failed. Please try again." }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
