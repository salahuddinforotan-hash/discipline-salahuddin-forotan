from app.database import settings


def azizi_connection_status() -> dict[str, str | bool]:
    """Report configuration without making assumptions about an undocumented API."""
    configured = all((
        settings.azizi_bank_api_base_url,
        settings.azizi_bank_client_id,
        settings.azizi_bank_client_secret,
    ))
    if configured:
        return {
            "status": "adapter_unavailable",
            "institution_name": "Azizi Bank",
            "message": "Provider credentials are present, but no authorized Azizi API adapter is available to synchronize accounts.",
            "statement_import_available": True,
        }
    return {
        "status": "not_configured",
        "institution_name": "Azizi Bank",
        "message": "Direct synchronization is not configured. You can import an authorized CSV statement instead.",
        "statement_import_available": True,
    }
