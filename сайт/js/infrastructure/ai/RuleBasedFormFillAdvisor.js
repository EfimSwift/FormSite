const LABELS = {
  fio: "ПІБ",
  unit_number: "номер військової частини",
  date_start: "дата початку",
  date_end: "дата закінчення",
  birth_date: "дата народження",
};

export class RuleBasedFormFillAdvisor {
  propose(variant, data) {
    const mappings = variant.placements.map((p) => {
      const value = (data[p.semantic] ?? "").trim();
      const confidence = value ? 0.92 : 0.15;
      return {
        semantic: p.semantic,
        value,
        confidence,
        reason: value
          ? `Поле «${LABELS[p.semantic]}» заповнено з введених даних`
          : `Немає значення для «${LABELS[p.semantic]}» у формі`,
      };
    });
    const filled = mappings.filter((m) => m.value).length;
    const score = mappings.length === 0 ? 0 : filled / mappings.length;
    return {
      variantId: variant.id,
      variantLabel: variant.label,
      mappings,
      score,
    };
  }

  rankVariants(variants, data) {
    return variants
      .map((v) => this.propose(v, data))
      .sort((a, b) => b.score - a.score);
  }
}
