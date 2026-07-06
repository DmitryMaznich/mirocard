import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getTopicTitle } from '@/shared/utils/format';
import './planner.css';

function CookPickerPhoto({ topicId, imagePath }) {
  const url = useTopicFile(topicId, imagePath);
  if (!url) return <div className="cook-picker-item__photo cook-picker-item__photo--empty" />;
  return <img className="cook-picker-item__photo" src={url} alt="" />;
}

export default function CookPickerSheet({ recipes, cookedTextIds, onPick, onClose }) {
  return (
    <div className="portions-sheet-backdrop" onClick={onClose}>
      <div className="portions-sheet cook-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="portions-sheet__handle" />
        <h2 className="portions-sheet__title">Что готовим?</h2>
        <ul className="cook-picker-list">
          {recipes.map((recipe) => {
            const isCooked = cookedTextIds?.has(recipe.text.id);
            return (
              <li key={recipe.text.id}>
                <button
                  type="button"
                  className={`cook-picker-item${isCooked ? ' cook-picker-item--done' : ''}`}
                  onClick={() => onPick(recipe)}
                >
                  <CookPickerPhoto topicId={recipe.topicId} imagePath={recipe.text.photo} />
                  <span className="cook-picker-item__name">{getTopicTitle(recipe.text.title)}</span>
                  {isCooked && <span className="cook-picker-item__check">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="portions-sheet__cancel" onClick={onClose}>
          Отменить
        </button>
      </div>
    </div>
  );
}
