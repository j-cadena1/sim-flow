# Claude Instructions

## General

- **Docker-first strategy**: All development, testing, and deployment runs in Docker containers
  - Use `make dev` for development (hot reload in containers)
  - Use `make test` and `make test-e2e` for testing (runs in containers)
  - Never instruct users to run `npm install` or `npm run dev` directly
  - The only prerequisites are Docker and Docker Compose
- Documentation matters. When editing or implementing new code, make sure to document thoroughly.

## Code

- Feature implementations will likely break/not be liked by the testing suite. When implementing new features, make sure it passes tests and if needed, re-write tests to make sure they fit the new feature implementation.

### TypeScript

- Avoid using "any" types where possible

### Documentation Standards

- Keep documentation in code comments and README.md where possible
- Only create standalone .md files for standard open-source docs (CHANGELOG.md, SECURITY.md, API.md, REVERSE-PROXY.md)
- GitHub templates (.github/) are fine and expected
- Avoid creating redundant documentation - consolidate into README instead of creating new .md files
