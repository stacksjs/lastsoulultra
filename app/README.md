# App Directory

This directory is for your custom application code that overrides the framework defaults.

## How Overrides Work

The Stacks framework first looks for files in this `app/` directory. If a file is not found here, it falls back to the defaults in `storage/framework/defaults/app/`.

## Common Override Locations

- **Actions/** - Custom action handlers for your routes
- **Controllers/** - Custom controllers
- **Jobs/** - Background job handlers
- **Middleware/** - Custom middleware
- **Models/** - Custom data models
- **Notifications/** - Custom notification handlers
- **Policies/** - Authorization policies

## Example: Overriding an Action

To override the default `PostIndexAction`, create:

```
app/Actions/Cms/PostIndexAction.ts
```

Your custom action will be used instead of the default.

## Creating New Files

Any new files you create here will be available to your application. For example, creating `app/Actions/MyCustomAction.ts` will make it available at `'Actions/MyCustomAction'` in your routes.

## LSU application boundaries

The local actions and mail classes customize website behavior, including newsletter confirmation. The race-entry account belongs to the external race service, while training accounts, coaching methods and calendar records belong to the separate platform installation.

Add website overrides here. Changes to shared training behavior must come through a new pinned platform kit rather than edits to generated `storage/native` source or the installed Pantry package. LSU-specific product configuration lives in `native/product.json`, `enterprise/presets.json` and `enterprise/catalog`.

Read [project conventions](../AGENTS.md) before changing models, actions, routes or jobs. Run the checks in [the root guide](../README.md#verify-changes) after an implementation change.
