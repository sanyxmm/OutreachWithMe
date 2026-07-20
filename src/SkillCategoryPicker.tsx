import { SKILL_CATEGORIES, type SkillCategoryChoice, type SkillCategoryId } from "./outreach";

interface SkillCategoryPickerProps {
  idPrefix: string;
  value: SkillCategoryChoice;
  onChange: (value: SkillCategoryChoice) => void;
}

function SkillCategoryPicker({ idPrefix, value, onChange }: SkillCategoryPickerProps) {
  function handleSelect(id: SkillCategoryId) {
    onChange({ id, custom: value.custom });
  }

  return (
    <section className="field skill-category-field">
      <label className="rl-field-label">Skill category</label>
      <div className="radio-group" role="radiogroup" aria-label="Skill category">
        {SKILL_CATEGORIES.map((cat) => (
          <label key={cat.id} className="radio-option">
            <input
              type="radio"
              name={`${idPrefix}-skill-category`}
              value={cat.id}
              checked={value.id === cat.id}
              onChange={() => handleSelect(cat.id)}
            />
            {cat.label}
          </label>
        ))}
      </div>
      {value.id === "other" && (
        <input
          type="text"
          className="skill-category-custom"
          placeholder="Enter custom skill category"
          value={value.custom ?? ""}
          onChange={(e) => onChange({ id: "other", custom: e.target.value })}
        />
      )}
    </section>
  );
}

export default SkillCategoryPicker;
