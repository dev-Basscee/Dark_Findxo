import json
import random
import asyncio
from urllib.parse import urlparse
from . import scraper as mod

async def run_dark(keyword: str, max_results: int = 5, depth: int = 0, rotate: bool = False):
    session_dir = mod.OUTPUT_BASE / f"{mod.sanitize_filename(keyword)}_{mod.ts()}"
    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / "raw").mkdir(exist_ok=True)
    (session_dir / "screenshots").mkdir(exist_ok=True)
    (session_dir / "text").mkdir(exist_ok=True)
    (session_dir / "reports").mkdir(exist_ok=True)
    links = mod.search_ahmia(keyword, max_results=max_results)
    (session_dir / "ahmia_results.json").write_text(json.dumps(links, indent=2), encoding="utf-8")
    results = []
    async with mod.async_playwright() as pw:
        for link in links:
            if rotate and getattr(mod, 'TOR_CONTROL', ''):
                try:
                    mod.rotate_tor_identity()
                except Exception:
                    pass
                await asyncio.sleep(1.5)
            meta, _ = await mod.scrape_onion_page(pw, link, session_dir / "reports", keyword, depth=0)
            results.append(meta)
            if depth and meta.get('links'):
                domain = urlparse(link).netloc
                internals = mod.internal_links_for_domain(meta['links'], domain)[:5]
                for il in internals:
                    try:
                        submeta, _ = await mod.scrape_onion_page(pw, il, session_dir / "reports", keyword, depth=1)
                        results.append(submeta)
                        await asyncio.sleep(random.uniform(1.0, 2.0))
                    except Exception:
                        continue
            await asyncio.sleep(random.uniform(1.0, 2.5))
    report = {
        "keyword": keyword,
        "found_count": len(links),
        "scraped_count": len(results),
        "session_dir": str(session_dir.resolve()),
        "timestamp": mod.ts(),
        "results": results,
    }
    (session_dir / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report
