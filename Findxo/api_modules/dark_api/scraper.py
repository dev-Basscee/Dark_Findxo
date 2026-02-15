#!/usr/bin/env python3
"""
Hybrid .onion Scraper (Ahmia -> Tor -> Playwright)
Modularized version of multi.py for FastAPI integration.
"""

import os
import re
import json
import time
import asyncio
import random
import hashlib
import logging
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urljoin

import requests
import certifi
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup
from dotenv import load_dotenv

logger = logging.getLogger("dark_scraper")

# Playwright (async)
try:
    from playwright.async_api import async_playwright
except (ImportError, RuntimeError):
    from .dummy_playwright import async_playwright
    logger.warning("Playwright not available, using dummy fallback")

# Optional stem for Tor control
try:
    from stem import Signal
    from stem.control import Controller
    STEM_AVAILABLE = True
except Exception:
    STEM_AVAILABLE = False

# Optional language detection
try:
    from langdetect import detect as detect_lang
    LANGDETECT_AVAILABLE = True
except Exception:
    LANGDETECT_AVAILABLE = False

# -----------------------
# Config / Env
# -----------------------
load_dotenv()

TOR_SOCKS = os.getenv("TOR_SOCKS", "127.0.0.1:9050")          # socks5 proxy
TOR_CONTROL = os.getenv("TOR_CONTROL", "")                    # host:port (optional)
TOR_CONTROL_PASS = os.getenv("TOR_CONTROL_PASS", "")          # password for control (optional)
CONCURRENCY = int(os.getenv("CONCURRENCY", "1"))
DEFAULT_DEPTH = int(os.getenv("DEPTH", "0"))

OUTPUT_BASE = Path("tor_scrape_output")
OUTPUT_BASE.mkdir(exist_ok=True)

logger = logging.getLogger("dark_scraper")

# Time helper
def ts():
    return time.strftime("%Y%m%d-%H%M%S")

# -----------------------
# Helpers
# -----------------------
def sanitize_filename(s: str) -> str:
    """Turn title/URL into filesystem-safe short name."""
    if not s:
        return "unknown"
    s = re.sub(r"^https?://", "", s, flags=re.I)
    s = s.strip().replace("/", "_")
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s)
    return s[:120]

def build_tor_proxies():
    # Use socks5h so DNS resolves through Tor
    return {
        "http": f"socks5h://{TOR_SOCKS}",
        "https": f"socks5h://{TOR_SOCKS}",
    }

def sha1_short(s: str) -> str:
    if not s:
        return "unknown"
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]

# Regex extractors
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", re.I)
PGP_RE = re.compile(r"-----BEGIN PGP PUBLIC KEY BLOCK-----.*?-----END PGP PUBLIC KEY BLOCK-----", re.S)
BTC_RE = re.compile(r"\b([13][a-km-zA-HJ-NP-Z1-9]{25,34})\b")
ETH_RE = re.compile(r"\b(0x[a-fA-F0-9]{40})\b")
XMR_RE = re.compile(r"\b4[0-9A-Za-z]{90,110}\b")
PHONE_RE = re.compile(r"\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}", re.I)
IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b", re.I)
CC_RE = re.compile(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b")

# -----------------------
# Tor control / NEWNYM
# -----------------------
def rotate_tor_identity():
    if not STEM_AVAILABLE or not TOR_CONTROL:
        return False, "Stem or TOR_CONTROL not configured"
    try:
        host, port = TOR_CONTROL.split(":")
        with Controller.from_port(address=host, port=int(port)) as c:
            if TOR_CONTROL_PASS:
                c.authenticate(password=TOR_CONTROL_PASS)
            else:
                c.authenticate()
            c.signal(Signal.NEWNYM)
        return True, "NEWNYM signal sent"
    except Exception as e:
        return False, f"Failed NEWNYM: {e}"

# -----------------------
# Ahmia search (via Tor)
# -----------------------
def clean_onion_links(raw_links):
    """
    Extracts real .onion links from Ahmia redirect URLs.
    """
    cleaned = []
    for link in raw_links:
        if not link:
            continue
        if "/search/redirect?" in link:
            qs = parse_qs(urlparse(link).query)
            if "redirect_url" in qs:
                onion_url = unquote(qs["redirect_url"][0])
                cleaned.append(onion_url)
        elif ".onion" in link:
            cleaned.append(link)
    return cleaned

def search_onion_engines(keyword: str, max_results: int = 10, timeout: int = 180):
    """
    Query multiple engines and returns clean .onion URLs.
    """
    from urllib.parse import parse_qs, unquote
    
    # Engine configurations
    engines = [
        {
            "name": "Ahmia (clearnet)",
            "base": "https://ahmia.fi/search/?q=",
            "proxies": None,
            "referer": "https://ahmia.fi/"
        },
        {
            "name": "Ahmia (onion)",
            "base": "http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion/search/?q=",
            "proxies": build_tor_proxies(),
            "referer": "http://juhanurmihxlp77nkq76byazcldy2hlmovfu2epvl5ankdibsot4csyd.onion/"
        },
        {
            "name": "Torch",
            "base": "http://torchdeedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion/search?query=",
            "proxies": build_tor_proxies(),
            "referer": "http://torchdeedp3i2jigzjdmfpn5ttjhthh5wbmda2rr3jvqjg5p77c54dqd.onion/"
        }
    ]

    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
    ]
    headers = {
        "User-Agent": random.choice(user_agents),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "DNT": "1"
    }

    session = requests.Session()
    retries = Retry(total=3, backoff_factor=5, status_forcelist=[400, 429, 500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))
    session.mount("http://", HTTPAdapter(max_retries=retries))

    for engine in engines:
        url = engine["base"] + quote_plus(keyword)
        headers["Referer"] = engine["referer"]
        proxies = engine["proxies"]

        if proxies:
            try:
                test_resp = requests.get(
                    "https://check.torproject.org",
                    proxies=proxies,
                    timeout=30,
                    verify=certifi.where()
                )
                if "Congratulations" not in test_resp.text:
                    logger.error(f"Tor proxy not working for {engine['name']}")
                    continue
            except Exception as e:
                logger.error(f"Tor test failed for {engine['name']}: {str(e)}")
                continue

        try:
            logger.info(f"Attempting {engine['name']} search for: {keyword}")
            resp = session.get(
                url,
                headers=headers,
                proxies=proxies,
                timeout=timeout,
                verify=certifi.where()
            )
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            raw_links = [a.get("href", "").strip() for a in soup.select("a[href]")]
            onion_links = clean_onion_links(raw_links)

            seen, final = set(), []
            for link in onion_links:
                if link not in seen:
                    final.append(link)
                    seen.add(link)
                if len(final) >= max_results:
                    break

            if final:
                logger.info(f"Found {len(final)} links via {engine['name']}")
                return final

        except Exception as e:
            logger.error(f"{engine['name']} error: {str(e)}")

    return []

# -----------------------
# Page processing helpers
# -----------------------
def extract_meta_from_html(html: str, base_url: str = "") -> dict:
    if not html:
        return {"title": "", "meta_description": "", "meta_keywords": "", "links": []}
    
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    if soup and soup.title and soup.title.string:
        title = soup.title.string.strip()
    
    meta_desc = ""
    meta_keywords = ""
    if soup:
        md = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
        if md and md.get("content"):
            meta_desc = md["content"].strip()
        mk = soup.find("meta", attrs={"name": "keywords"})
        if mk and mk.get("content"):
            meta_keywords = mk["content"].strip()
    
    links = []
    if soup:
        for a in soup.select("a[href]"):
            href = a.get("href", "").strip()
            if not href:
                continue
            if base_url and not href.startswith("http"):
                try:
                    href = urljoin(base_url, href)
                except Exception:
                    pass
            links.append(href)
    return {"title": title, "meta_description": meta_desc, "meta_keywords": meta_keywords, "links": links}

def find_keyword_context(text: str, keyword: str, window: int = 160) -> list:
    if not keyword or not text:
        return []
    k = keyword.lower()
    excerpts = []
    for m in re.finditer(re.escape(k), text.lower()):
        start = max(0, m.start() - window)
        end = min(len(text), m.end() + window)
        context = text[start:end].strip().replace("\n", " ")
        context = re.sub(r'\s+', ' ', context)
        highlighted_context = re.sub(f'({re.escape(keyword)})', r'**\1**', context, flags=re.IGNORECASE)
        excerpts.append(highlighted_context)
    
    unique_excerpts = []
    seen = set()
    for excerpt in excerpts:
        key = excerpt[:50].lower()
        if key not in seen:
            unique_excerpts.append(excerpt)
            seen.add(key)
    return unique_excerpts[:5]

def extract_entities(text: str) -> dict:
    if not text:
        return {
            "emails": [], "pgp_keys": [], "btc_addresses": [], 
            "eth_addresses": [], "xmr_addresses": [], "phones": [],
            "ibans": [], "credit_cards": []
        }
    
    emails = list(set(EMAIL_RE.findall(text)))
    pgps = PGP_RE.findall(text)
    btc = list(set(BTC_RE.findall(text)))
    eth = list(set(ETH_RE.findall(text)))
    xmr = list(set(XMR_RE.findall(text)))
    phones = list(set(PHONE_RE.findall(text)))
    ibans = list(set(IBAN_RE.findall(text)))
    cc = list(set(CC_RE.findall(text)))
    
    btc_filtered = [addr for addr in btc if 26 <= len(addr) <= 35]
    eth_filtered = [addr for addr in eth if len(addr) == 42 and addr.startswith('0x')]
    
    return {
        "emails": emails, 
        "pgp_keys": pgps, 
        "btc_addresses": btc_filtered, 
        "eth_addresses": eth_filtered, 
        "xmr_addresses": xmr,
        "phones": [p for p in phones if len(p.strip()) > 8],
        "ibans": ibans,
        "credit_cards": cc
    }

# -----------------------
# Scrape onion page (Playwright)
# -----------------------
async def scrape_onion_page(playwright, url: str, out_dir: Path, keyword: str = "", depth: int = 0):
    browser = await playwright.chromium.launch(
        headless=True,
        proxy={"server": f"socks5://{TOR_SOCKS}"},
        args=["--no-sandbox", "--disable-dev-shm-usage"]
    )
    context = await browser.new_context(viewport={"width": 1280, "height": 900})
    page = await context.new_page()

    safe_name = sanitize_filename(url) + "_" + sha1_short(url)
    site_dir = out_dir / safe_name
    site_dir.mkdir(parents=True, exist_ok=True)

    meta = {
        "url": url,
        "scraped_at": ts(),
        "ok": False,
        "entities": {},
        "depth": depth
    }

    try:
        logger.info(f"Scraping {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(random.uniform(1.0, 2.5))

        raw_html = await page.content()
        html_path = site_dir / f"{safe_name}.html"
        html_path.write_text(raw_html, encoding="utf-8", errors="replace")
        
        shot_path = site_dir / f"{safe_name}.png"
        await page.screenshot(path=str(shot_path), full_page=True)

        visible_text = await page.inner_text("body")
        text_path = site_dir / f"{safe_name}.txt"
        text_path.write_text(visible_text, encoding="utf-8", errors="replace")

        parsed = extract_meta_from_html(raw_html, base_url=url)
        meta.update(parsed)
        meta["entities"] = extract_entities(visible_text + "\n" + raw_html)

        if keyword:
            meta["keywords_found"] = find_keyword_context(visible_text, keyword)

        meta["ok"] = True
    except Exception as e:
        meta["error"] = str(e)
        logger.error(f"Error scraping {url}: {e}")
    finally:
        await context.close()
        await browser.close()
        return meta

# -----------------------
# Main Runner
# -----------------------
async def run_dark_scrape(keyword: str, max_results: int = 5, depth: int = 0, rotate: bool = False):
    session_id = f"{sanitize_filename(keyword)}_{ts()}"
    session_dir = OUTPUT_BASE / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    report_dir = session_dir / "reports"
    report_dir.mkdir(exist_ok=True)

    onion_links = search_onion_engines(keyword, max_results=max_results)
    if not onion_links:
        return {"error": "No links found", "keyword": keyword}

    results = []
    async with async_playwright() as pw:
        for link in onion_links:
            if rotate:
                rotate_tor_identity()
                await asyncio.sleep(5)
            
            res = await scrape_onion_page(pw, link, report_dir, keyword, depth=0)
            results.append(res)
            await asyncio.sleep(random.uniform(2, 5))

    report = {
        "session_id": session_id,
        "keyword": keyword,
        "timestamp": ts(),
        "results": results
    }
    
    with open(session_dir / "report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    return report
