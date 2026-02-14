#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'findxo_django.settings')
    try:
        import importlib
        django_mgmt = importlib.import_module("django.core.management")
        execute_from_command_line = django_mgmt.execute_from_command_line
    except Exception as exc:
        raise ImportError(
            "Django is not available in this environment; please activate your virtualenv or install Django (e.g. 'pip install django')."
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
