#!/usr/bin/env python3
"""
Hybrid .onion Scraper (Ahmia -> Tor -> Playwright)
Saves: raw HTML, screenshot, text, meta JSON per site + master session report.json

Usage: python hybrid_onion_scraper.py
"""

import os
import re
import json
import time
import asyncio
import random
import hashlib
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Playwright (async)
from playwright.async_api import async_playwright

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

# Time helper
def ts():
    return time.strftime("%Y%m%d-%H%M%S")

# -----------------------
# Helpers
# -----------------------
def sanitize_filename(s: str) -> str:
    """Turn title/URL into filesystem-safe short name."""
    if not s:  # Added null check
        return "unknown"
    s = re.sub(r"^https?://", "", s, flags=re.I)
    s = s.strip().replace("/", "_")
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s)
    return s[:120]

def build_tor_proxies():
    # use socks5h so DNS resolves through Tor
    return {
        "http": f"socks5h://{TOR_SOCKS}",
        "https": f"socks5h://{TOR_SOCKS}",
    }

def sha1_short(s: str) -> str:
    if not s:  # Added null check
        return "unknown"
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]

# Regex extractors
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", re.I)
PGP_RE = re.compile(r"-----BEGIN PGP PUBLIC KEY BLOCK-----.*?-----END PGP PUBLIC KEY BLOCK-----", re.S)
# Bitcoin-like (very permissive, filter later)
BTC_RE = re.compile(r"\b([13][a-km-zA-HJ-NP-Z1-9]{25,34})\b")
ETH_RE = re.compile(r"\b(0x[a-fA-F0-9]{40})\b")
XMR_RE = re.compile(r"\b4[0-9A-Za-z]{90,110}\b")

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


from urllib.parse import urlparse, parse_qs, unquote

def clean_onion_links(raw_links):
    """
    Extracts real .onion links from Ahmia redirect URLs.
    """
    cleaned = []
    for link in raw_links:
        if not link:  # Added null check
            continue
        if "/search/redirect?" in link:
            # Extract ?redirect_url=...
            qs = parse_qs(urlparse(link).query)
            if "redirect_url" in qs:
                onion_url = unquote(qs["redirect_url"][0])
                cleaned.append(onion_url)
        elif ".onion" in link:
            cleaned.append(link)
    return cleaned





# -----------------------
# Ahmia search (via Tor) - FIXED
# -----------------------


def search_ahmia(keyword: str, max_results: int = 10, timeout: int = 40):
    """
    Query Ahmia.fi over Tor and return a list of clean .onion URLs.
    """
    from urllib.parse import quote_plus

    base = "https://ahmia.fi/search/?q="
    url = base + quote_plus(keyword)
    proxies = build_tor_proxies()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/114.0 Safari/537.36"
    }

    resp = requests.get(url, headers=headers, proxies=proxies, timeout=timeout)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Extract all Ahmia results
    raw_links = [a.get("href", "").strip() for a in soup.select("a[href]")]
    onion_links = clean_onion_links(raw_links)

    # Deduplicate + limit
    seen, final = set(), []
    for link in onion_links:
        if link not in seen:
            final.append(link)
            seen.add(link)
        if len(final) >= max_results:
            break

    return final



# -----------------------
# Page processing helpers
# -----------------------
def extract_meta_from_html(html: str, base_url: str = "") -> dict:
    if not html:  # Added null check for HTML
        return {"title": "", "meta_description": "", "meta_keywords": "", "links": []}
    
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    if soup and soup.title and soup.title.string:  # Added proper null checks
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
    # gather links
    links = []
    if soup:
        for a in soup.select("a[href]"):
            href = a.get("href", "").strip()  # Added default empty string
            if not href:  # Skip empty hrefs
                continue
            # normalize relative links
            if base_url and not href.startswith("http"):
                try:
                    href = urljoin(base_url, href)
                except Exception:
                    pass
            links.append(href)
    return {"title": title, "meta_description": meta_desc, "meta_keywords": meta_keywords, "links": links}

def find_keyword_context(text: str, keyword: str, window: int = 160) -> list:
    """Return list of small excerpts where keyword appears (case-insensitive)."""
    if not keyword or not text:  # Added null checks
        return []
    k = keyword.lower()
    excerpts = []
    
    for m in re.finditer(re.escape(k), text.lower()):
        start = max(0, m.start() - window)
        end = min(len(text), m.end() + window)
        context = text[start:end].strip().replace("\n", " ")
        
        # Clean up context and add relevance indicators
        context = re.sub(r'\s+', ' ', context)  # Normalize whitespace
        
        # Highlight the keyword match (case-insensitive)
        highlighted_context = re.sub(
            f'({re.escape(keyword)})', 
            r'**\1**', 
            context, 
            flags=re.IGNORECASE
        )
        
        excerpts.append(highlighted_context)
    
    # Remove duplicates while preserving order
    unique_excerpts = []
    seen = set()
    for excerpt in excerpts:
        # Use first 50 chars as deduplication key
        key = excerpt[:50].lower()
        if key not in seen:
            unique_excerpts.append(excerpt)
            seen.add(key)
    
    def context_relevance(context):
        threat_terms = ['hack', 'breach', 'dump', 'leak', 'stolen', 'illegal', 'market', 'sell', 'buy']
        return sum(1 for term in threat_terms if term in context.lower())
    
    unique_excerpts.sort(key=context_relevance, reverse=True)
    
    return unique_excerpts[:5]  # Return top 5 most relevant contexts

def extract_entities(text: str) -> dict:
    if not text:  # Added null check for text
        return {"emails": [], "pgp_keys": [], "btc_addresses": [], "eth_addresses": [], "xmr_addresses": []}
    
    emails = list(set(EMAIL_RE.findall(text)))
    pgps = PGP_RE.findall(text)
    btc = list(set(BTC_RE.findall(text)))
    eth = list(set(ETH_RE.findall(text)))
    xmr = list(set(XMR_RE.findall(text)))
    
    # Filter out false positive Bitcoin addresses
    btc_filtered = []
    for addr in btc:
        if len(addr) >= 26 and len(addr) <= 35:  # Valid Bitcoin address length
            # Basic checksum validation could be added here
            btc_filtered.append(addr)
    
    # Filter out false positive Ethereum addresses  
    eth_filtered = []
    for addr in eth:
        if len(addr) == 42 and addr.startswith('0x'):  # Valid Ethereum address format
            eth_filtered.append(addr)
    
    # Enhanced email validation
    email_filtered = []
    for email in emails:
        # Filter out common false positives
        if not any(fp in email.lower() for fp in ['example.com', 'test.com', 'localhost', 'domain.com']):
            if '@' in email and '.' in email.split('@')[1]:
                email_filtered.append(email)
    
    return {
        "emails": email_filtered, 
        "pgp_keys": pgps, 
        "btc_addresses": btc_filtered, 
        "eth_addresses": eth_filtered, 
        "xmr_addresses": xmr
    }

# -----------------------
# Scrape onion page (Playwright)
# -----------------------
async def scrape_onion_page(playwright, url: str, out_dir: Path, keyword: str = "", depth: int = 0):
    """Visit a .onion URL via Playwright over Tor and save artifacts & meta."""
    session = playwright
    browser = await session.chromium.launch(
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
        "safe_name": safe_name,
        "scraped_at": ts(),
        "ok": False,
        "error": None,
        "title": None,
        "meta_description": None,
        "meta_keywords": None,
        "language": None,
        "keywords_found": [],
        "text_excerpt": None,
        "entities": {},
        "links": [],
        "raw_html_file": None,
        "screenshot_file": None,
        "text_file": None,
        "depth": depth
    }

    try:
        print(f"[+] Opening {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        # polite human-like actions
        await asyncio.sleep(random.uniform(1.0, 2.5))
        # small scrolls
        for _ in range(random.randint(3, 7)):
            await page.mouse.wheel(0, random.randint(300, 1000))
            await asyncio.sleep(random.uniform(0.6, 1.6))

        # Grab raw html
        try:
            raw_html = await page.content()
        except Exception:
            try:
                raw_html = await page.evaluate("() => document.documentElement.outerHTML")
            except Exception:  # Added fallback for HTML extraction
                raw_html = ""

        if raw_html:  # Only save if HTML exists
            html_path = site_dir / f"{safe_name}.html"
            html_path.write_text(raw_html, encoding="utf-8", errors="replace")
            meta["raw_html_file"] = str(html_path)

        # Screenshot
        try:  # Added try-catch for screenshot
            shot_path = site_dir / f"{safe_name}.png"
            await page.screenshot(path=str(shot_path), full_page=True)
            meta["screenshot_file"] = str(shot_path)
        except Exception as e:
            print(f"[!] Screenshot failed for {url}: {e}")

        # Extract visible text (best effort)
        visible_text = ""
        try:
            visible_text = await page.inner_text("body")
        except Exception:
            try:
                visible_text = await page.evaluate("() => document.body ? document.body.innerText : ''")
            except Exception:
                visible_text = ""

        if visible_text:  # Only save if text exists
            text_path = site_dir / f"{safe_name}.txt"
            text_path.write_text(visible_text, encoding="utf-8", errors="replace")
            meta["text_file"] = str(text_path)

        # Parse meta from HTML
        parsed = extract_meta_from_html(raw_html, base_url=url)
        meta["title"] = parsed.get("title")
        meta["meta_description"] = parsed.get("meta_description")
        meta["meta_keywords"] = parsed.get("meta_keywords")
        meta["links"] = parsed.get("links", [])

        # Entities
        entities = extract_entities(visible_text + "\n" + (raw_html or ""))  # Added null check for raw_html
        meta["entities"] = entities

        # Language
        if LANGDETECT_AVAILABLE and visible_text and visible_text.strip():  # Added null check for visible_text
            try:
                meta["language"] = detect_lang(visible_text)
            except Exception:
                meta["language"] = "unknown"
        else:
            meta["language"] = "unknown"

        # Keyword contexts and scoring
        if keyword and visible_text:  # Added null check for visible_text
            contexts = find_keyword_context(visible_text, keyword, window=200)
            meta["keywords_found"] = contexts
            meta["text_excerpt"] = contexts[0] if contexts else None

            # simple relevance score: frequency normalized by length
            freq = len(re.findall(re.escape(keyword), visible_text, flags=re.I))
            length = max(1, len(visible_text))
            meta["relevance_score"] = round(freq / length * 10000, 4)  # scaled small number
        else:
            meta["relevance_score"] = 0.0

        meta["ok"] = True
        print(f"[✔] Scraped {url} -> saved to {site_dir}")

    except Exception as e:
        meta["error"] = str(e)
        print(f"[!] Error scraping {url}: {e}")

    finally:
        # Save meta
        meta_path = site_dir / "meta.json"
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        await context.close()
        await browser.close()
        return meta, site_dir

# -----------------------
# Depth-limited crawling helper
# -----------------------
def internal_links_for_domain(links: list, domain: str):
    out = []
    for l in links:
        if not l:
            continue
        try:
            lp = urlparse(l)
            if lp.netloc and domain in lp.netloc:
                out.append(l)
        except Exception:
            continue
    return out

# -----------------------
# Orchestrator
# -----------------------
async def run_session():
    print("=== Hybrid .onion Scraper (Ahmia -> Tor) ===")
    keyword = input("Keyword to search on Ahmia: ").strip()
    max_results = input("Max .onion results to visit (default 5): ").strip()
    max_results = int(max_results) if max_results.isdigit() else 5
    depth = input(f"Crawl depth (default {DEFAULT_DEPTH}, 0 = root only): ").strip()
    depth = int(depth) if depth.isdigit() else DEFAULT_DEPTH
    rotate = False
    if TOR_CONTROL:
        rotate = input("Rotate Tor identity before each site? (y/N): ").strip().lower() == "y"

    # prepare session folder
    session_dir = OUTPUT_BASE / f"{sanitize_filename(keyword)}_{ts()}"
    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / "raw").mkdir(exist_ok=True)
    (session_dir / "screenshots").mkdir(exist_ok=True)
    (session_dir / "text").mkdir(exist_ok=True)
    (session_dir / "reports").mkdir(exist_ok=True)

    try:
        print("[*] Searching Ahmia via Tor (this uses Tor SOCKS proxy)...")
        onion_links = search_ahmia(keyword, max_results=max_results)
    except Exception as e:
        print(f"[!] Ahmia search failed: {e}")
        return

    if not onion_links:
        print("[!] No .onion links found for that keyword.")
        return

    (session_dir / "ahmia_results.json").write_text(json.dumps(onion_links, indent=2), encoding="utf-8")
    print(f"[+] Found {len(onion_links)} onion links. Starting scrape...")

    results = []

    async with async_playwright() as pw:
        # sequential for simplicity and to avoid Tor bandwidth issues; can be parallel with care
        for idx, link in enumerate(onion_links, start=1):
            if rotate:
                ok, msg = rotate_tor_identity()
                print(("[✔]" if ok else "[!]"), msg)
                # polite wait to let Tor change circuit
                await asyncio.sleep(3 + random.random() * 3)

            meta, site_dir = await scrape_onion_page(pw, link, session_dir / "reports", keyword, depth=0)
            results.append(meta)

            # if depth > 0, follow internal links up to depth
            if depth and meta.get("links"):
                domain = urlparse(link).netloc
                internals = internal_links_for_domain(meta["links"], domain)
                # limit number of internal links to avoid explosion
                internals = internals[:5]
                for j, il in enumerate(internals, start=1):
                    try:
                        if rotate:
                            ok, msg = rotate_tor_identity()
                            print(("[✔]" if ok else "[!]"), msg)
                            await asyncio.sleep(2 + random.random() * 2)
                        submeta, subdir = await scrape_onion_page(pw, il, session_dir / "reports", keyword, depth=1)
                        results.append(submeta)
                        await asyncio.sleep(random.uniform(1.0, 3.0))
                    except Exception as e:
                        print(f"[!] Sub-scrape failed for {il}: {e}")

            # polite pause between top-level sites
            await asyncio.sleep(random.uniform(2.0, 5.0))

    # write session index
    master_report = {
        "keyword": keyword,
        "found_count": len(onion_links),
        "scraped_count": len(results),
        "session_dir": str(session_dir.resolve()),
        "timestamp": ts(),
        "results": results
    }
    (session_dir / "report.json").write_text(json.dumps(master_report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n=== Done. Session saved in: {session_dir.resolve()} ===")
    print("Summary written to report.json")

if __name__ == "__main__":
    try:
        asyncio.run(run_session())
    except KeyboardInterrupt:
        print("\n[!] Interrupted by user")
