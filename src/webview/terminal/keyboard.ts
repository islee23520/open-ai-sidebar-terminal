const isLetterOrDigitChord = (event: KeyboardEvent): boolean => {
  if (event.altKey) {
    return false;
  }

  if (!event.ctrlKey && !event.metaKey) {
    return false;
  }

  return /^Key[A-Z]$/.test(event.code) || /^Digit[0-9]$/.test(event.code);
};

export function createKeyboardHandler() {
  const handler = (event: KeyboardEvent): boolean => {
    if (isLetterOrDigitChord(event)) {
      event.preventDefault();
      event.stopPropagation();
    }

    return true;
  };

  return {
    handler,
  };
}
