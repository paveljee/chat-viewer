MISE := $(HOME)/.local/bin/mise
BUN_VERSION := $(shell awk '$$1 == "bun" { print $$2; exit }' .tool-versions)
BUN := $(MISE) exec bun@$(BUN_VERSION) -- bun

.DEFAULT_GOAL := help

.PHONY: help install lint test

help:
	@printf '%s\n' \
		'Targets:' \
		'  make install  Install pinned mise and Bun dependencies' \
		'  make lint     Strict typecheck of all TS code with pinned Bun' \
		'  make test     Run unit and end-to-end tests with pinned Bun' \

install:
	bash install.sh

lint:
	$(BUN) run check

test:
	$(BUN) run test
