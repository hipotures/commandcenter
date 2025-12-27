"""
Pricing calculator for Claude models.
Fetches pricing data from LiteLLM and calculates costs based on token usage.
Uses disk cache to work offline and only updates when needed.
"""

import json
import requests
from pathlib import Path
from typing import Optional, Dict
from dataclasses import dataclass

PRICING_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
DEFAULT_TIERED_THRESHOLD = 200_000
CACHE_TIMEOUT = 8.0  # seconds

# Cache file location
PRICING_CACHE_FILE = Path.home() / ".claude" / "db" / "pricing_cache.json"

# Provider prefixes to try when looking up model pricing
PROVIDER_PREFIXES = [
    "anthropic/",
    "bedrock/",
    "vertex_ai/",
    "claude-3-5-",
    "claude-3-",
    "claude-",
    "openrouter/openai/",
]

# Model aliases mapping
MODEL_ALIASES = {
    "claude-3-opus": "claude-3-opus-20240229",
    "claude-3-sonnet": "claude-3-sonnet-20240229",
    "claude-3-haiku": "claude-3-haiku-20240307",
    "claude-3.5-sonnet": "claude-3-5-sonnet-20241022",
    "claude-3.5-haiku": "claude-3-5-haiku-20241022",
    "claude-opus-4": "claude-opus-4-20250514",
    "claude-sonnet-4": "claude-sonnet-4-20250514",
}

# Global cache for pricing data
_pricing_cache: Optional[Dict] = None


@dataclass
class ModelPricing:
    """Pricing information for a model."""
    input_cost_per_token: float
    input_cost_per_token_above_200k: Optional[float]
    cache_creation_cost_per_token: float
    cache_creation_cost_per_token_above_200k: Optional[float]
    cached_input_cost_per_token: float
    cached_input_cost_per_token_above_200k: Optional[float]
    output_cost_per_token: float
    output_cost_per_token_above_200k: Optional[float]


def load_from_disk() -> Optional[Dict]:
    """Load pricing cache from disk."""
    try:
        if PRICING_CACHE_FILE.exists():
            with open(PRICING_CACHE_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return None


def save_to_disk(data: Dict) -> None:
    """Save pricing cache to disk."""
    try:
        PRICING_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(PRICING_CACHE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception:
        pass  # Fail silently if can't write


def fetch_from_remote() -> Optional[Dict]:
    """Fetch pricing from LiteLLM GitHub."""
    try:
        response = requests.get(PRICING_URL, timeout=CACHE_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


def load_pricing_dataset(force_update: bool = False) -> Dict:
    """
    Load pricing dataset with intelligent caching.

    Strategy:
    1. Try memory cache (if available)
    2. Try disk cache (if exists)
    3. Fetch from remote (if force_update or no cache)
    4. Return empty dict if all fails (no pricing available)

    Args:
        force_update: Force fetch from remote even if cache exists
    """
    global _pricing_cache

    # 1. Memory cache
    if _pricing_cache is not None and not force_update:
        return _pricing_cache

    # 2. Disk cache
    if not force_update:
        disk_cache = load_from_disk()
        if disk_cache:
            _pricing_cache = disk_cache
            return _pricing_cache

    # 3. Fetch from remote
    remote_data = fetch_from_remote()
    if remote_data:
        _pricing_cache = remote_data
        save_to_disk(remote_data)
        return _pricing_cache

    # 4. Fallback to disk cache even if stale
    disk_cache = load_from_disk()
    if disk_cache:
        _pricing_cache = disk_cache
        return _pricing_cache

    # 5. No pricing available
    return {}


def create_candidates(model: str) -> list[str]:
    """Create list of candidate model names to try."""
    candidates = {model}

    # Add alias if exists
    alias = MODEL_ALIASES.get(model)
    if alias:
        candidates.add(alias)

    # Add prefixed versions
    for prefix in PROVIDER_PREFIXES:
        candidates.add(f"{prefix}{model}")
        if alias:
            candidates.add(f"{prefix}{alias}")

    return list(candidates)


def normalize_pricing(record: Dict) -> ModelPricing:
    """Normalize pricing record from LiteLLM format."""
    def to_per_token(value, fallback=0.0) -> float:
        return float(value) if value is not None and isinstance(value, (int, float)) else fallback

    def to_optional_per_token(value) -> Optional[float]:
        return float(value) if value is not None and isinstance(value, (int, float)) else None

    return ModelPricing(
        input_cost_per_token=to_per_token(record.get('input_cost_per_token')),
        input_cost_per_token_above_200k=to_optional_per_token(record.get('input_cost_per_token_above_200k_tokens')),
        cache_creation_cost_per_token=to_per_token(record.get('cache_creation_input_token_cost')),
        cache_creation_cost_per_token_above_200k=to_optional_per_token(record.get('cache_creation_input_token_cost_above_200k_tokens')),
        cached_input_cost_per_token=to_per_token(record.get('cache_read_input_token_cost')),
        cached_input_cost_per_token_above_200k=to_optional_per_token(record.get('cache_read_input_token_cost_above_200k_tokens')),
        output_cost_per_token=to_per_token(record.get('output_cost_per_token')),
        output_cost_per_token_above_200k=to_optional_per_token(record.get('output_cost_per_token_above_200k_tokens')),
    )


def get_model_pricing(model: str) -> Optional[ModelPricing]:
    """
    Get pricing for a model.

    Strategy:
    1. Try to find in current pricing dataset
    2. If not found, try to update pricing from remote (model might be new)
    3. Try again with updated pricing
    4. Return None if not found (costs will not be calculated)

    Args:
        model: Model name (e.g., "claude-3-5-sonnet-20241022")

    Returns:
        ModelPricing or None if not found
    """
    def find_in_dataset(data: Dict) -> Optional[ModelPricing]:
        """Try to find model in pricing dataset."""
        # Try exact match and aliases
        candidates = create_candidates(model)
        for candidate in candidates:
            if candidate in data:
                return normalize_pricing(data[candidate])

        # Fallback: substring match (best-effort)
        model_lower = model.lower()
        for key, value in data.items():
            key_lower = key.lower()
            if model_lower in key_lower or key_lower in model_lower:
                return normalize_pricing(value)

        return None

    # 1. Try current pricing dataset
    pricing_data = load_pricing_dataset()
    result = find_in_dataset(pricing_data)
    if result:
        return result

    # 2. Model not found - try to update pricing (might be new model)
    print(f"Model '{model}' not found in pricing cache, attempting to update...")
    pricing_data = load_pricing_dataset(force_update=True)
    result = find_in_dataset(pricing_data)
    if result:
        return result

    # 3. Still not found - no pricing available
    print(f"Warning: No pricing found for model '{model}', costs will not be calculated")
    return None


def calculate_tiered_cost(
    total_tokens: int,
    base_price: float,
    tiered_price: Optional[float],
    threshold: int = DEFAULT_TIERED_THRESHOLD
) -> float:
    """Calculate cost with tiered pricing."""
    if total_tokens <= 0:
        return 0.0

    if total_tokens > threshold and tiered_price is not None:
        tokens_below = min(total_tokens, threshold)
        tokens_above = max(0, total_tokens - threshold)

        cost = tokens_above * tiered_price
        if base_price > 0:
            cost += tokens_below * base_price
        return cost

    if base_price > 0:
        return total_tokens * base_price

    return 0.0


def calculate_cost_usd(
    input_tokens: int,
    output_tokens: int,
    cache_creation_tokens: int,
    cache_read_tokens: int,
    pricing: ModelPricing
) -> float:
    """Calculate total cost in USD for token usage."""
    input_cost = calculate_tiered_cost(
        max(input_tokens, 0),
        pricing.input_cost_per_token,
        pricing.input_cost_per_token_above_200k
    )

    output_cost = calculate_tiered_cost(
        max(output_tokens, 0),
        pricing.output_cost_per_token,
        pricing.output_cost_per_token_above_200k
    )

    cache_creation_cost = calculate_tiered_cost(
        max(cache_creation_tokens, 0),
        pricing.cache_creation_cost_per_token,
        pricing.cache_creation_cost_per_token_above_200k
    )

    cache_read_cost = calculate_tiered_cost(
        max(cache_read_tokens, 0),
        pricing.cached_input_cost_per_token,
        pricing.cached_input_cost_per_token_above_200k
    )

    return input_cost + output_cost + cache_creation_cost + cache_read_cost


def update_pricing_cache() -> bool:
    """
    Manually update pricing cache from remote.

    Returns:
        True if update was successful, False otherwise
    """
    print("Updating pricing cache from LiteLLM...")
    remote_data = fetch_from_remote()

    if remote_data:
        global _pricing_cache
        _pricing_cache = remote_data
        save_to_disk(remote_data)
        print(f"✓ Pricing cache updated successfully ({len(remote_data)} models)")
        print(f"  Cache saved to: {PRICING_CACHE_FILE}")
        return True
    else:
        print("✗ Failed to update pricing cache (network error or timeout)")
        return False
