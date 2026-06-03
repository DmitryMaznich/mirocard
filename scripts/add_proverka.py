import re
import os

def process_recipe(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    result = []
    i = 0
    extra = 0  # сколько "Проверка!" уже вставлено

    while i < len(lines):
        line = lines[i]
        step_match = re.match(r'^(\d+)\. (.*)', line)

        if step_match:
            original_num = int(step_match.group(1))
            step_text = step_match.group(2)
            new_num = original_num + extra
            result.append(f'{new_num}. {step_text}')

            is_section = (
                'Подготовить посуду' in step_text or
                'Подготовь посуду' in step_text or
                'Подготовить продукты' in step_text or
                'Подготовь продукты' in step_text
            )

            if is_section:
                i += 1
                # собираем все подпункты (строки начинающиеся с - или *)
                while i < len(lines) and re.match(r'^[-*] ', lines[i]):
                    result.append(lines[i])
                    i += 1
                # вставляем Проверка!
                extra += 1
                result.append(f'{new_num + 1}. Проверка!')
                continue
        else:
            result.append(line)

        i += 1

    new_content = '\n'.join(result)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

recipe_dir = r'c:\Users\dmazn\Projects\Mirocard2\content\recipes'
for filename in sorted(os.listdir(recipe_dir)):
    if filename.endswith('.txt'):
        filepath = os.path.join(recipe_dir, filename)
        process_recipe(filepath)
        print(f'OK: {filename}')

print('Done!')
