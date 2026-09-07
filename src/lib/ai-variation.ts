let variationSeed = 0;

export function pickVariation(options: string[], ctx?: { currentMinutes?: number; turnCount?: number }): string {
  if (options.length === 0) return '';
  if (options.length === 1) return options[0];

  let hash = variationSeed;
  if (ctx) {
    hash += ctx.currentMinutes ?? 0;
    hash += (ctx.turnCount ?? 0) * 7;
  }
  const index = Math.abs(hash) % options.length;
  variationSeed = (variationSeed + 1) % 1000;
  return options[index];
}

export function confidencePhrase(confidence: number): string {
  if (confidence >= 0.8) return pickVariation(['You usually', 'You consistently', 'You tend to']);
  if (confidence >= 0.5) return pickVariation(['You often', 'It looks like you', 'You tend to']);
  if (confidence >= 0.3) return pickVariation(['Recently I\'ve noticed you', 'It seems you', 'You sometimes']);
  return pickVariation(['I\'ve seen you', 'Occasionally you', 'A few times you\'ve']);
}

export function greetingPrefix(currentMinutes: number, casual?: boolean): string {
  if (casual) return pickVariation(['Hey', 'Hi there', 'Hey there']);
  if (currentMinutes < 12 * 60) return pickVariation(['Good morning', 'Morning']);
  if (currentMinutes < 17 * 60) return pickVariation(['Good afternoon', 'Afternoon']);
  return pickVariation(['Good evening', 'Evening']);
}

export function emptyDayPhrase(): string {
  return pickVariation([
    'Looks like a clean day. Enjoy it!',
    'Nothing scheduled — nice open day.',
    'You\'ve got a blank slate today.',
    'No fixed commitments. Make of it what you will.',
  ]);
}

export function focusSuggestionPhrase(): string {
  return pickVariation([
    'Want me to suggest what to focus on?',
    'Want me to prioritise things?',
    'Should I work out what\'s most important?',
    'I can prioritise your day if you want.',
  ]);
}
