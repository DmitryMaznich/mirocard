import re, os

# Matches: N units (установить таймер на N units)
TIMER_RE = re.compile(
    r'\d+\s*(?:минут[ауы]?|секунд[ауы]?)\s*'
    r'\((установить таймер на \d+\s*(?:минут[ауы]?|секунд[ауы]?))\)',
    re.IGNORECASE
)

# Strip trailing duration like " 5 минут" or ", 5 минут" (when number was before the paren)
DURATION_TAIL = re.compile(
    r',?\s*\d+\s*(?:минут[ауы]?|секунд[ауы]?)\s*$',
    re.IGNORECASE
)

def transform_line(line):
    m = TIMER_RE.search(line)
    if not m:
        return line

    timer_phrase = m.group(1)          # "установить таймер на 15 минут"
    before = line[:m.start()]          # text before "N units (timer)"
    after  = line[m.end():]            # text after closing ")"

    # Find the last real sentence break in 'before' (a ". " not from a step number)
    last_break = -1
    for match in re.finditer(r'\.\s', before):
        dot_prefix = before[:match.start()].lstrip('    -*\t ')
        if not dot_prefix.isdigit():    # not a step-number dot
            last_break = match.end()

    if last_break >= 0:
        prefix        = before[:last_break]
        sentence_part = before[last_break:]
    else:
        step_m = re.match(r'^(\s*(?:\d+\.\s*|[-*]\s+))', before)
        if step_m:
            prefix        = step_m.group(1)
            sentence_part = before[step_m.end():]
        else:
            prefix        = ''
            sentence_part = before

    # Remove trailing "N units" (or just leading/trailing punctuation) from sentence_part
    sentence_clean = DURATION_TAIL.sub('', sentence_part).rstrip(', \t')

    # Rebuild
    after_stripped = after.lstrip()

    if after_stripped.startswith(','):
        # Continuation after comma → keep with verb
        rest = after_stripped.rstrip()
        if not rest.endswith('.'):
            rest += '.'
        verb_line = sentence_clean + rest
    elif after_stripped.startswith('.'):
        remaining = after_stripped[1:].strip()
        verb_line = sentence_clean + '.'
        if remaining:
            verb_line += ' ' + remaining
    else:
        verb_line = sentence_clean
        if verb_line and not verb_line.endswith('.'):
            verb_line += '.'

    timer_sentence = 'Установить ' + timer_phrase[len('установить '):]  # capitalise
    return prefix + timer_sentence + '. ' + verb_line


recipe_dir = r'c:\Users\dmazn\Projects\Mirocard2\content\recipes'
for fname in sorted(os.listdir(recipe_dir)):
    if not fname.endswith('.txt'):
        continue
    path = os.path.join(recipe_dir, fname)
    with open(path, encoding='utf-8') as f:
        original = f.read()
    lines    = original.split('\n')
    new_lines = [transform_line(l) for l in lines]
    new_content = '\n'.join(new_lines)
    if new_content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'OK: {fname}')
        for old, new in zip(lines, new_lines):
            if old != new:
                print(f'  - {old.strip()}')
                print(f'  + {new.strip()}')
print('done')
