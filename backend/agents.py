SUPPORTED_AGENTS = ("claude", "codex")
DEFAULT_AGENT = "claude"

AGENT_COMMANDS = {
    "claude": "claude",
    "codex": "codex",
}

# Codex CLI versions can reject unsupported values in ~/.codex/config.toml.
# Provide a stable default to avoid startup failure from user-global config drift.
AGENT_ARGS = {
    "claude": [],
    "codex": ["-c", 'model_reasoning_effort="high"'],
}

AGENT_INSTALL_HINTS = {
    "claude": "https://docs.anthropic.com/en/docs/claude-code",
    "codex": "https://platform.openai.com/docs/codex",
}


def normalize_agent(agent: str | None) -> str:
    if not agent:
        return DEFAULT_AGENT
    return agent.strip().lower()


def is_supported_agent(agent: str) -> bool:
    return agent in SUPPORTED_AGENTS
