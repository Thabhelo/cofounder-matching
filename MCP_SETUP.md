# MCP Server Setup Guide

This guide covers installing and configuring Model Context Protocol (MCP) servers for Claude Code to enhance development efficiency.

## Currently Recommended MCP Servers

### 1. Exa Search (HIGH PRIORITY)
**Purpose**: Enhanced web search and code context retrieval

**Installation**:
```bash
# Get API key from: https://dashboard.exa.ai/api-keys
claude mcp add exa -e EXA_API_KEY=YOUR_API_KEY -- npx -y exa-mcp-server
```

**Tools**:
- `web_search_exa` - Real-time web search
- `get_code_context_exa` - Search for code examples and documentation
- `deep_search_exa` - Deep web search with query expansion (optional)

**Why**: Better than built-in search for finding up-to-date documentation, examples, and solutions.

---

### 2. PostgreSQL MCP (HIGH PRIORITY)
**Purpose**: Direct database operations and schema inspection

**Installation**:
```bash
npm install -g @modelcontextprotocol/server-postgres
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost/dbname
```

**Why**: Essential for database migrations, schema validation, and data inspection without leaving Claude Code.

---

### 3. GitHub MCP (RECOMMENDED)
**Purpose**: Direct GitHub operations (issues, PRs, commits)

**Installation**:
```bash
claude mcp add github -e GITHUB_TOKEN=YOUR_TOKEN -- npx -y @modelcontextprotocol/server-github
```

**Why**: Eliminates context switching - create issues, review PRs, manage repos directly.

---

### 4. Next.js Devtools MCP (RECOMMENDED)
**Purpose**: Next.js-specific development tools

**Installation**:
```bash
npx @vercel/next-devtools-mcp init
```

**Why**: Error detection, live state queries, browser testing for Next.js apps.

---

### 5. Augments Documentation MCP (RECOMMENDED)
**Purpose**: Real-time access to 90+ framework docs (FastAPI, Next.js, Tailwind, etc.)

**Installation**:
```bash
npm install -g @augmentsai/augments-mcp
claude mcp add augments -- npx -y @augmentsai/augments-mcp
```

**Why**: Always up-to-date API references and best practices for our tech stack.

---

### 6. Sequential Thinking MCP (OPTIONAL)
**Purpose**: Enhanced problem-solving with structured reasoning

**Installation**:
```bash
claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
```

**Why**: Better for complex architectural decisions and debugging.

---

## Installation Priority

**Phase 1 - Now**:
1. Exa Search (web search and code examples)
2. PostgreSQL MCP (database work)

**Phase 2 - Before Development Starts**:
3. GitHub MCP (repo management)
4. Next.js Devtools MCP (frontend development)
5. Augments Documentation MCP (framework docs)

**Phase 3 - Optional**:
6. Sequential Thinking MCP (complex problems)

---

## Verification

After installation, verify MCPs are loaded:
```bash
# Check Claude Code MCP status
claude mcp list
```

---

## Configuration Notes

- All MCP servers are configured globally for Claude Code
- Some require API keys (store in environment variables)
- Can be enabled/disabled per project via settings
- MCPs persist across Claude Code sessions

---

## Troubleshooting

**MCP not showing up**:
1. Restart Claude Code
2. Check API keys are valid
3. Verify Node.js/npm are installed: `node --version`

**Permission errors**:
```bash
# Fix npm global permissions
sudo chown -R $USER /usr/local/lib/node_modules
```

---

## Useful Links

- Exa Dashboard: https://dashboard.exa.ai/
- MCP Documentation: https://modelcontextprotocol.io/
- Awesome MCP Servers: https://github.com/punkpeye/awesome-mcp-servers
