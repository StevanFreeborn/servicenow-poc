export function isNotNullUndefinedOrWhitespace(
  value: string | null | undefined,
) {
  return (
    value !== null && value !== undefined && value.replace(/\s/g, "").length > 0
  );
}
