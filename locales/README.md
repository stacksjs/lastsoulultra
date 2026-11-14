# Website translations

This directory holds application translation resources for the Stacks website. The independently packaged training application has its own language files in the platform kit; editing a website translation here does not change its native app screens.

Keep visible labels consistent with the page and account flow they describe. The user guide identifies English and German app destinations where the wording differs, such as **Me** / **Ich** and **Training progress** / **Fortschritt**.

Before adding locale behavior, read `storage/framework/defaults/ai/skills/stacks-i18n/SKILL.md` and inspect the translation format already used by the feature. Verify both the default language and the fallback language after a change.

See [project conventions](../AGENTS.md) and [training source ownership](../native/README.md).
