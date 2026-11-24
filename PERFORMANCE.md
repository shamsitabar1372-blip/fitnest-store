# FitNestPro performance and local preview

Implemented on 2026-11-24.

- Six local photos/banners now use lossless WebP at their original full resolution. Their decoded pixels were compared with the original files and verified identical. No downscaled variants are served. Original CSS crops are preserved. The remote shadow photo uses its original URL.
- Updated after the quality requirement: six original images total 12,572,325 bytes; lossless versions total 6,736,684 bytes (46.4% smaller). Earlier lossy/downsized figures no longer apply.
- Below-fold banner images load lazily and decode asynchronously. The first hero keeps high priority. Carousel updates responsive sources together and prepares only the next slide during idle time (skipped for slow/save-data connections).
- Self-hosted Manrope, Michroma and Vazirmatn WOFF2 fonts, with their original OFL licenses and font-display: swap. Google Fonts requests removed.
- Extracted CSS/JS to content-versioned assets for caching, with deferred JavaScript. Removed obsolete raster-logo rules. Reduced mobile header blur and respected reduced-motion preferences. Carousel pauses while the tab is hidden.
- Map SDK already loads on demand; preserved this behavior.
- `.htaccess` enables Apache/LiteSpeed gzip and cache headers when supported by the host. A live CDN, production TLS and Brotli need the selected host/CDN and cannot be activated by editing local HTML alone.

## External-image limitation

The first hero image and two category photos remain at their original external URLs. Downloads from Unsplash failed with connection resets, and the Gear category host timed out. Their images were not substituted. Provide original files locally to finish self-hosting them; existing page behavior depends on those external servers until then.

## Run locally

From PowerShell:

```powershell
cd 'D:\Website tesy gigi'
python serve.py
```

Open http://127.0.0.1:8080/ . Stop with Ctrl+C. The preview server serves only index.html and assets, implements gzip, ETag/304 and asset cache headers. It is a preview server, not a production commerce backend.

Optional same-Wi-Fi/LAN test: `python serve.py --lan`. Use this computer's LAN IP with port 8080 from the second device; Windows Firewall may require an explicit rule. No firewall/router changes were made.

Public home hosting is technically possible, but requires a public reachable IP or an appropriate tunnel, HTTPS, DNS configuration, a hardened production server, reliable upload bandwidth and continuous uptime. Whether direct hosting works depends on the ISP's CGNAT/port restrictions. A normal hosting service is preferable for the live shop. Authentication and payments are still prototype features, independent of static hosting.

## Verify and package

`python scripts/check-performance.py` checks HTTP gzip, ETag 304, caching and private-file isolation, plus JS syntax. Static image references/CSS URLs were checked and original versus compressed imagery was visually compared. The optimized page was also opened in the browser with working product cards and navigation controls. No Lighthouse score or real-user measurements were collected.

`python scripts/package-static.py` builds `output/FitNestPro-upload.zip`; upload its contents to a static web root (e.g. public_html on Apache). It excludes originals, work files, proposals and temporary dependencies. Keep index.html and assets together.

Moving from file:// to localhost changes the browser origin: existing localStorage carts/profile data do not automatically move. Existing file:// data is not deleted.

Account feedback now appears above the login form in 14px high-contrast text; missing-account errors receive focus so users can find them.

Slide 1 update: both main and overlay photos now use byte-identical local JPEG files (Men.jpg and wom). Only the two category photos still depend on external image URLs.

Final category-photo update: Supp.avif and GEATT.jpg are now copied byte-for-byte into assets and used instead of external image URLs. All displayed photos are local. No file resizing, transcoding, or quality changes were applied to these two files.
