import re, os

# Строки, которые нужно полностью убрать (весь шаг)
FULL_REMOVE = [
    r'Разложить по тарелкам',
    r'Выложить курицу в тарелку\.',
    r'Переложить яичницу лопаткой на тарелку\.',
    r'Выложить котлеты на тарелку\.',
    r'Переложить омлет на тарелку',
    r'Разлить суп по тарелкам',
    r'Разлить по стаканам',
    r'Разлить лимонад по стаканам',
    r'Разлить холодный чай по стаканам',
]

# Фраза, которую нужно вырезать только из середины строки (buckwheat)
PARTIAL_STRIP = r'\s*Разложить кашу по тарелкам\.?'

def should_remove(line):
    for pat in FULL_REMOVE:
        if re.search(pat, line):
            return True
    return False

def process(path):
    with open(path, encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    result = []
    removed = 0
    extra = 0  # смещение нумерации

    for line in lines:
        # Частичная замена (гречка — "Готово! ... Разложить по тарелкам")
        if re.search(PARTIAL_STRIP, line):
            line = re.sub(PARTIAL_STRIP, '', line).rstrip()

        if should_remove(line):
            removed += 1
            continue  # пропускаем строку

        # Перенумерация оставшихся шагов
        step_m = re.match(r'^(\d+)\. (.*)', line)
        if step_m and removed > 0:
            old_num = int(step_m.group(1))
            new_num = old_num - removed
            line = f'{new_num}. {step_m.group(2)}'

        result.append(line)

    new_content = '\n'.join(result)
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'OK: {os.path.basename(path)} (-{removed} шаг(ов))')

recipe_dir = r'c:\Users\dmazn\Projects\Mirocard2\content\recipes'
for fname in sorted(os.listdir(recipe_dir)):
    if fname.endswith('.txt'):
        process(os.path.join(recipe_dir, fname))
print('done')
