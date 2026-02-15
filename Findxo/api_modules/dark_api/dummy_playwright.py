class AsyncPlaywright:
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    @property
    def chromium(self):
        return self
    async def launch(self, **kwargs):
        raise RuntimeError("Playwright is not supported in this environment.")

def async_playwright():
    return AsyncPlaywright()
