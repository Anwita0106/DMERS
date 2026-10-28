"""Download the public-domain disaster photos used by the DMERS site into frontend/public/images/.

    python tools/download_photos.py

Every photo is a U.S. Government work (public domain) hosted on Wikimedia Commons; the list and
credits match frontend/src/lib/photos.ts and docs/PHOTO_CREDITS.md. Files that already exist are
skipped. Needs internet access; uses only the Python standard library.
"""
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "images"
PHOTOS = {
    "hero": "101st_Rescue_Squadron_-_Hurricane_Katrina_Rescue.jpg",
    "earthquake": "US_Navy_110315-N-5503T-756_A_Japanese_search_and_rescue_team_searches_the_rubble_near_a_high-rise_building_in_Northern_Japan.jpg",
    "flood": "FEMA_downtown_Cedar_Rapids_Iowa_flood_2008.jpg",
    "cyclone": "Hurricane_Isabel_from_ISS.jpg",
    "tsunami": "US_Navy_110315-N-2653B-054_The_city_of_Ofunato,_Japan,_is_severely_damaged_by_a_9.0_magnitude_earthquake_and_subsequent_tsunami.jpg",
    "wildfire": "Rim_Fire_20130817-FS-UNK-0027_(9626930351).jpg",
    "landslide": "Thistlelandslideusgs.jpg",
    "heatwave": "Corn_shows_the_affect_of_drought.jpg",
    "storm": "Lightning_NOAA.jpg",
}
UA = "DMERS-student-project/7.0 (photo download script; contact: project owner)"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    ok = failed = 0
    for key, name in PHOTOS.items():
        target = OUT / f"{key}.jpg"
        if target.exists() and target.stat().st_size > 10_000:
            print(f"  have  {target.name}")
            ok += 1
            continue
        width = 1920 if key == "hero" else 1000
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(name)}?width={width}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 10_000 or data[:3] != b"\xff\xd8\xff":
                raise ValueError("not a JPEG image")
            target.write_bytes(data)
            print(f"  saved {target.name} ({len(data) // 1024} KB)")
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED {key}: {e}")
            failed += 1
    print(f"\n{ok} photo(s) ready in {OUT}" + (f", {failed} failed (the site loads those from Wikimedia instead)" if failed else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
