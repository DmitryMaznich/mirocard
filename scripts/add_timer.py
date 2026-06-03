import re, os

# Глаголы приготовления, после которых имеет смысл таймер
COOKING_RE = re.compile(
    r'(?:варить|тушить|жарить|обжаривать|обжарить|подогревать|подождать|томить|запекать)',
    re.IGNORECASE
)

# Число + единица времени, НЕ предшествуемое "в " (исключает "раз в 2 минуты")
# Lookbehind фиксированной ширины: 2 символа "в "
TIME_RE = re.compile(r'(?<!в )(\d+)\s*(минут[ауы]?|секунд[ауы]?)', re.IGNORECASE)

def process(path):
    with open(path, encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    result = []
    changed = False

    for line in lines:
        # Уже есть упоминание таймера — пропустить
        if 'таймер' in line.lower():
            result.append(line)
            continue
        # Нет глагола приготовления — пропустить
        if not COOKING_RE.search(line):
            result.append(line)
            continue

        def add_timer(m):
            num, unit = m.group(1), m.group(2)
            return f'{num} {unit} (установить таймер на {num} {unit})'

        new_line = TIME_RE.sub(add_timer, line)
        if new_line != line:
            changed = True
        result.append(new_line)

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(result))
        print(f'OK: {os.path.basename(path)}')

recipe_dir = r'c:\Users\dmazn\Projects\Mirocard2\content\recipes'
for fname in sorted(os.listdir(recipe_dir)):
    if fname.endswith('.txt'):
        process(os.path.join(recipe_dir, fname))
print('Done.')
