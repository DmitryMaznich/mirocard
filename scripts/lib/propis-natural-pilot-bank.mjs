// Whole generated vocal events, with no cutting, looping, or time stretching.
export const PROPIS_NATURAL_PILOT = [
  { letter: "с", ipa: "s", direction: "sustain the unvoiced Russian consonant /s/ for 0.8 seconds with a natural complete ending" },
  { letter: "ш", ipa: "ʂ", direction: "sustain the hard Russian consonant /ʂ/ (ш) as a steady unvoiced shushing sound for 0.8 seconds, with a natural complete ending" },
  { letter: "м", ipa: "m", direction: "sustain the Russian consonant /m/ as a steady voiced closed-lip nasal sound for 0.7 seconds, then finish naturally" },
  { letter: "к", ipa: "k", direction: "produce one complete hard Russian consonant /k/: a clear velar closure and audible release, then silence; no following vowel" },
  { letter: "б", ipa: "b", direction: "produce one complete hard Russian consonant /b/: voiced closed-lip closure and clear audible release, then silence; no following vowel" },
].map((entry, order) => ({ ...entry, key: `sound_${entry.letter}`, label: `${entry.letter.toUpperCase()} — звук [${entry.letter}]`, category: "Проба без обрезки", order }));

export function naturalPilotPart(entry) {
  return {
    text: `<${entry.direction}>`,
    speech_metadata: { style: "A native Russian speech therapist demonstrating one isolated speech sound for a child. Produce only the requested consonant, without a vowel or the alphabet letter name. Steady comfortable volume, ordinary speaking pitch, clear relaxed articulation. No words, music, explanation, singing, or abrupt interruption." },
  };
}
