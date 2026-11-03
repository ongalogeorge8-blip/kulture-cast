#!/usr/bin/env python3
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

CHANNEL_ID = "UCBTP_EeSROI0vgazMih--Yw"
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "social-updates.json"
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
ATOM = "http://www.w3.org/2005/Atom"
YOUTUBE = "http://www.youtube.com/xml/schemas/2015"
MEDIA = "http://search.yahoo.com/mrss/"

def fetch_feed():
    request = urllib.request.Request(FEED_URL, headers={"User-Agent": "KultureCastFeedUpdater/1.0"})
    error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                if response.status != 200:
                    raise RuntimeError(f"YouTube returned HTTP {response.status}")
                return response.read()
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError) as caught:
            error = caught
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to fetch YouTube RSS after retries: {error}")

def valid_thumbnail(url, video_id):
    parsed = urllib.parse.urlparse(url)
    return (parsed.scheme == "https" and parsed.hostname == "i.ytimg.com" and parsed.path.startswith(f"/vi/{video_id}/"))

def parse_feed(payload):
    root = ET.fromstring(payload)
    items = []
    seen = set()
    for entry in root.findall(f"{{{ATOM}}}entry"):
        video_id = (entry.findtext(f"{{{YOUTUBE}}}videoId") or "").strip()
        title = (entry.findtext(f"{{{ATOM}}}title") or "").strip()
        published = (entry.findtext(f"{{{ATOM}}}published") or "").strip()
        description = (entry.findtext(f"{{{MEDIA}}}group/{{{MEDIA}}}description") or "").strip()
        thumbnail_element = entry.find(f"{{{MEDIA}}}group/{{{MEDIA}}}thumbnail")
        thumbnail = thumbnail_element.get("url", "") if thumbnail_element is not None else ""
        if not (VIDEO_ID.fullmatch(video_id) and title and video_id not in seen):
            continue
        url = f"https://www.youtube.com/watch?v={video_id}"
        if not valid_thumbnail(thumbnail, video_id):
            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
        if not valid_thumbnail(thumbnail, video_id):
            continue
        items.append({"id": video_id, "title": title, "url": url, "image": thumbnail, "published": published, "description": description, "platform": "YouTube"})
        seen.add(video_id)
        if len(items) == 12:
            break
    return items

def main():
    try:
        items = parse_feed(fetch_feed())
    except (RuntimeError, ET.ParseError) as error:
        print(f"Feed refresh failed; keeping existing data: {error}", file=sys.stderr)
        return 1
    if not items:
        print("Feed refresh produced no valid videos; keeping existing data.", file=sys.stderr)
        return 1
    data = {"source": "YouTube", "channel": "@kulturecast", "items": items}
    rendered = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if OUTPUT.exists() and OUTPUT.read_text(encoding="utf-8") == rendered:
        print("YouTube feed is already current.")
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(rendered, encoding="utf-8")
    print(f"Updated {OUTPUT} with {len(items)} videos.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
