# Lessons

- Render build environments with `NODE_ENV=production` cause `npm ci` to omit dev dependencies. If the build command compiles TypeScript, explicitly include dev dependencies (`NPM_CONFIG_PRODUCTION=false` or `npm ci --include=dev`) while keeping the runtime in production mode.
