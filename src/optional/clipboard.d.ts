/** A function that copies text, or undefined when the app has no clipboard module */
export function clipboardSetter(): ((text: string) => Promise<unknown>) | undefined
