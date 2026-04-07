prettier "**/*.{md,yaml,yml,toml}" --write --single-quote --log-level error
prettier . --check --log-level error
eslint --fix *> $null
eslint --fix --quiet
typos -w
