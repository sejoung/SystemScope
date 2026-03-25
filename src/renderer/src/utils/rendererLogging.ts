export async function reportRendererError(
  scope: string,
  message: string,
  details?: unknown
): Promise<void> {
  try {
    await window.systemScope.logRendererError(scope, message, details)
  } catch (error) {
    console.error(`[${scope}] ${message}`, details, error)
  }
}
