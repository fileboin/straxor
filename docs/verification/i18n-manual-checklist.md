# I18n manual verification checklist

## Goal
Verify that language switching in Straxor is not only visual, but actually changes translated UI text and persists until the user selects another language.

## Expected rules
- English is the default/fallback language.
- If the user manually selects another language, that selection must persist across refreshes and navigation.
- Missing translations must fall back to English.
- The language switcher must update visible UI labels, placeholders, helper text, and status text.

## Quick verification flow

### 1. Default behavior
1. Open the app in a clean browser session.
2. Ensure `localStorage['straxor.lang']` is empty or absent.
3. Reload the app.
4. Expected:
   - UI loads in English by default when no saved language exists.
   - If the browser language is supported, the app may use it only when there is no saved selection.

### 2. Persistence behavior
1. Open the language switcher in the top status bar.
2. Select `Srpski`.
3. Refresh the page.
4. Navigate to another screen and back.
5. Close and reopen the tab if needed.
6. Expected:
   - `localStorage['straxor.lang'] === 'sr'`
   - The app remains in Serbian until another language is selected.

### 3. Ask/Agent panel checks
With `Srpski` selected, verify these texts are localized:
- Ask input placeholder
- Agent input placeholder
- Budget popover title
- Budget labels: cost, tokens, steps, duration
- Uploading state
- Remove attachment label
- Microphone processing label
- Microphone stop label
- Camera/microphone permission errors

### 4. API key UI checks
Open any provider key input and verify:
- loading text
- key configured / key required status
- placeholder text
- save button label
- show/hide key tooltip
- delete/remove key action

### 5. Fallback checks
1. Switch to a non-English language.
2. Inspect screens where translations were previously incomplete.
3. Expected:
   - translated strings appear in the selected language
   - any still-missing key falls back to English, not raw key names

## Suggested spot checks
Test at least these languages:
- `en`
- `sr`
- `de`
- `fr`
- `ja`

## Technical evidence in code
- Saved language is read from `localStorage` key `straxor.lang`
- Manual language changes are persisted back to `localStorage`
- Translation lookup uses `currentLang` first, then English fallback
