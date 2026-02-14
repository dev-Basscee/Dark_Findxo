# Findxo API

This is the main API for the Findxo project. It's a FastAPI application that uses a Django backend for data storage and authentication.

## Setup

1.  **Create and activate a virtual environment:**

    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```

2.  **Install the dependencies:**

    There are two `requirements.txt` files that need to be installed.

    ```bash
    pip install -r django_api/requirements.txt
    pip install -r api_modules/requirements.txt
    playwright install
    ```

3.  **Run the database migrations:**

    ```bash
    python django_api/manage.py migrate
    ```

4.  **Run the API:**

    ```bash
    uvicorn api_modules.app:app --host 0.0.0.0 --port 8000
    ```

## Usage

The API is protected by API keys. You need to get an API key from the admin dashboard.

Here's an example of how to use the `/dark/search` endpoint:

```bash
curl -X POST "http://127.0.0.1:8000/v1/dark/search" \
-H "Content-Type: application/json" \
-H "x-api-key: YOUR_API_KEY" \
-d '{"keyword":"example","max_results":1}'
```