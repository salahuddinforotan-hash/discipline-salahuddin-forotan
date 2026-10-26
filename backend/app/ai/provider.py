from typing import Any

import httpx

from app.database import settings


def provider_configuration(provider_override: str | None = None, model_override: str | None = None) -> dict[str, Any]:
    requested_provider = (provider_override or settings.ai_provider or "").strip().lower()
    if requested_provider:
        provider = requested_provider
    elif settings.ollama_model:
        provider = "ollama"
    else:
        provider = "openai"

    if provider == "ollama":
        model = model_override or settings.ollama_model or settings.ai_model
        return {
            "configured": bool(model),
            "provider": "Ollama",
            "model": model,
            "local": True,
            "data_sent_externally": False,
            "base_url": (settings.ollama_base_url or "http://127.0.0.1:11434").rstrip("/"),
            "api_key": None,
            "endpoint": "/api/chat",
            "message": "Ollama is ready." if model else "Set OLLAMA_MODEL and make Ollama reachable from the backend server.",
        }

    if provider in {"openai", "openai-compatible"}:
        model = model_override or settings.ai_model
        base_url = (
            "https://api.openai.com/v1"
            if provider == "openai"
            else (settings.ai_base_url or "").rstrip("/")
        )
        key_required = provider == "openai" or base_url == "https://api.openai.com/v1"
        display_provider = "OpenAI" if provider == "openai" else "OpenAI-compatible"
        missing = []
        if not model:
            missing.append("AI_MODEL")
        if provider == "openai-compatible" and not base_url:
            missing.append("AI_BASE_URL")
        if key_required and not settings.ai_api_key:
            missing.append("AI_API_KEY")
        configured = not missing
        if missing:
            message = (
                f"Set {', '.join(missing)} in the backend environment. "
                "Provider keys stay on the server and are never stored in the app."
            )
        else:
            message = f"{display_provider} settings are present. Test the connection to verify the model is reachable."
        return {
            "configured": configured,
            "provider": display_provider,
            "model": model,
            "local": False,
            "data_sent_externally": configured,
            "base_url": base_url,
            "api_key": settings.ai_api_key,
            "endpoint": "/chat/completions",
            "message": message,
        }

    return {
        "configured": False,
        "provider": provider,
        "model": settings.ai_model,
        "local": False,
        "data_sent_externally": False,
        "base_url": "",
        "api_key": None,
        "endpoint": "",
        "message": "AI_PROVIDER must be 'openai', 'openai-compatible', or 'ollama'.",
    }


def ai_status(provider_override: str | None = None, model_override: str | None = None) -> dict[str, Any]:
    config = provider_configuration(provider_override, model_override)
    return {key: config[key] for key in ("configured", "provider", "model", "local", "data_sent_externally", "message")}


def generate_completion(
    messages: list[dict[str, str]],
    provider_override: str | None = None,
    model_override: str | None = None,
) -> str:
    config = provider_configuration(provider_override, model_override)
    if not config["configured"]:
        raise ValueError(config["message"])

    timeout = httpx.Timeout(max(5, min(settings.ai_request_timeout_seconds, 120)), connect=8.0)
    try:
        if config["provider"] == "Ollama":
            response = httpx.post(
                f"{config['base_url']}{config['endpoint']}",
                json={"model": config["model"], "messages": messages, "stream": False, "options": {"temperature": 0.35}},
                timeout=timeout,
            )
            response.raise_for_status()
            result = response.json()
            content = result.get("message", {}).get("content")
        else:
            headers = {"Content-Type": "application/json"}
            if config["api_key"]:
                headers["Authorization"] = f"Bearer {config['api_key']}"
            response = httpx.post(
                f"{config['base_url']}{config['endpoint']}",
                headers=headers,
                json={"model": config["model"], "messages": messages, "temperature": 0.35},
                timeout=timeout,
            )
            response.raise_for_status()
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content")
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        if status_code in {401, 403}:
            message = "The AI provider rejected the server credentials. Check the API key and provider access in the backend environment."
        elif status_code == 404:
            message = "The AI provider could not find that model or endpoint. Check the model name and provider URL."
        elif status_code == 429:
            message = "The AI provider is rate-limiting requests or the account has no available quota. Try again later or check the provider account."
        elif status_code >= 500:
            message = "The AI provider is temporarily unavailable. Try again shortly."
        else:
            message = f"The AI provider returned an error (HTTP {status_code}). Check the provider settings and try again."
        raise RuntimeError(message) from exc
    except httpx.TimeoutException as exc:
        raise RuntimeError("The AI provider took too long to respond. Check the server connection or increase AI_REQUEST_TIMEOUT_SECONDS.") from exc
    except httpx.ConnectError as exc:
        raise RuntimeError("The app server cannot reach the AI provider. Check its address and confirm the provider is running.") from exc
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
        raise RuntimeError("The AI provider could not complete the request. Check the server connection and provider settings.") from exc

    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("The AI provider returned an empty response. Please try again.")
    return content.strip()
