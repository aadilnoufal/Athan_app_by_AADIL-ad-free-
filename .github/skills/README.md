# GitHub Copilot Skills

This folder contains specialized skills that enhance GitHub Copilot's capabilities for specific tasks. Skills provide domain-specific knowledge, instructions, and best practices that help Copilot perform complex tasks more effectively.

## What Are Skills?

Skills are self-contained folders with a `SKILL.md` file that contains instructions, patterns, and guidance for specific tasks. When GitHub Copilot loads a skill, it uses that knowledge to better understand and complete related tasks.

## Available Skills

### 📄 Document Processing (from Anthropic)

Production-grade document manipulation skills:

- **docx** - Create, read, edit Word documents (.docx files)
- **pdf** - Extract, merge, split, and manipulate PDF files
- **pptx** - Create and edit PowerPoint presentations
- **xlsx** - Read, create, and modify Excel spreadsheets

### 🔧 Development Tools (from Anthropic)

- **mcp-builder** - Build Model Context Protocol (MCP) servers in Python or TypeScript
- **web-artifacts-builder** - Create complex React artifacts with Tailwind CSS and shadcn/ui

### 🌐 Web Testing & Automation (from Anthropic)

- **webapp-testing** - Python-based Playwright testing for local web apps

### ⚡ Performance Optimization (from Tech Leads Club)

- **core-web-vitals** - Optimize LCP, INP, and CLS metrics
- **perf-astro** - Astro-specific performance optimizations
- **perf-lighthouse** - Run and interpret Lighthouse audits
- **perf-web-optimization** - General web performance optimization

### ✅ Quality & Best Practices (from Tech Leads Club)

- **seo** - Search engine optimization
- **web-accessibility** - WCAG 2.1 accessibility auditing
- **web-best-practices** - Modern web development standards
- **web-quality-audit** - Comprehensive quality audits

### 🔒 Security (from Tech Leads Club)

- **security-best-practices** - Language-specific security reviews
- **security-ownership-map** - Analyze code ownership and bus factor
- **security-threat-model** - Create repository-grounded threat models

## Sources

This skill collection combines skills from:

1. **Anthropic** - Production document skills and development tools
2. **Tech Leads Club** - Community skills from [tech-leads-club.github.io/agent-skills/](https://tech-leads-club.github.io/agent-skills/)

## Compatibility

✅ **All skills are verified compatible with GitHub Copilot.** These skills use standard tools and frameworks that work seamlessly with GitHub Copilot's skill system.

**Requirements for specific skills:**

- Performance skills require Node.js and npm (for Lighthouse)
- Web testing requires Python and Playwright
- Document skills use Python libraries (automatically guided during use)

## How to Use

GitHub Copilot automatically loads skills from the `.github/skills/` folder. Simply mention the task or document type in your request, and Copilot will use the appropriate skill.

Examples:

- "Create a PDF from these images" → Uses `pdf` skill
- "Audit this site for accessibility" → Uses `web-accessibility` skill
- "Build an MCP server" → Uses `mcp-builder` skill

## Creating Custom Skills

Create a new folder in `.github/skills/` with a `SKILL.md` file:

```markdown
---
name: my-skill-name
description: Clear description of what this skill does and when to use it
---

# My Skill Name

[Instructions and guidelines here]
```

The `description` field is crucial - it tells GitHub Copilot when to activate this skill.

## License

- Anthropic skills: See individual LICENSE files (document skills are source-available)
- Tech Leads Club skills: Check individual skill folders for license information
