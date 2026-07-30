# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## StoryCanvas Continuity Decision

Content continuity is driven by structured world memory, not by chaining every previous end frame. Characters, objects, locations, and brands keep canonical identity and versioned state; each shot declares the entities it reads, its required start state, mutations, camera, and cut relation. Only `continuous-action` shots may opt into a previous end frame. Other cuts inherit entity/world state and approved references while remaining free to recompose the frame.
