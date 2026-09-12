export function emptyUserData() {
  return {
    fio: "",
    unit_number: "",
    date_start: "",
    date_end: "",
    birth_date: "",
  };
}

export const FIELD_META = [
  { key: "fio", label: "ПІБ", type: "text" },
  { key: "unit_number", label: "Номер військової частини", type: "text" },
  { key: "birth_date", label: "Дата народження", type: "date" },
  { key: "date_start", label: "Дата початку періоду", type: "date" },
  { key: "date_end", label: "Дата закінчення періоду", type: "date" },
];

export function formatScore(score) {
  return `${Math.round(score * 100)}%`;
}
