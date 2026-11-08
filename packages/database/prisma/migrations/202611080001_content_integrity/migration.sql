-- Match JavaScript String.trim() whitespace without altering code indentation.
-- Validation is intentional: existing invalid rows must be inspected, never silently deleted.
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_content_not_blank"
CHECK ("content" ~ U&'[^\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]');
