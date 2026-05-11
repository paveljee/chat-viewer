MISE := $(HOME)/.local/bin/mise
BUN_VERSION := $(shell awk '$$1 == "bun" { print $$2; exit }' .tool-versions)
BUN := $(MISE) exec bun@$(BUN_VERSION) -- bun

.DEFAULT_GOAL := help

.PHONY: help install dev run lint test

help:
	@printf '%s\n' \
		'Targets:' \
		'  make install  Install pinned mise and Bun dependencies' \
		'  make run      Run the app with pinned Bun' \
		'  make lint     Strict typecheck of all TS code with pinned Bun' \
		'  make test     Run unit and end-to-end tests with pinned Bun' \

install:
	bash install.sh

run:
	$(BUN) run run

lint:
	$(BUN) run check

test:
	$(BUN) run test
